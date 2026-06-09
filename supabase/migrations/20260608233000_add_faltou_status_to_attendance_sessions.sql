-- Migration: Add Faltou status to attendance_sessions and update conflict check RPC
-- Description: Alters constraints, updates RPC functions for conflicts and reports with search_path hardening.

-- 1. Drop existing constraint on attendance_sessions status
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;

-- 2. Add updated constraint allowing 'Faltou' and 'Não Realizado'
ALTER TABLE public.attendance_sessions ADD CONSTRAINT attendance_sessions_status_check 
CHECK (status = ANY (ARRAY['Realizada'::text, 'Pendente'::text, 'Glosado'::text, 'Não Realizado'::text, 'Faltou'::text]));

-- 3. Update the conflict checking RPC function to exclude 'Faltou' sessions for professional availability (BR-010)
CREATE OR REPLACE FUNCTION public.check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME WITHOUT TIME ZONE,
  p_end TIME WITHOUT TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL AND (p_patient_id IS NULL OR p_professional_id IS NULL) THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  -- Patient cannot overlap any session (including Faltou, to block double scheduling/attendance)
  SELECT 'O Paciente já possui atendimento neste horário na clínica ' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-010)
  -- Professional cannot overlap other sessions, EXCEPT if those sessions are marked as 'Faltou'
  SELECT 'O Profissional já está ocupado na clínica ' || c.name || ' com o paciente ' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND s.status != 'Faltou' -- Professional is released if the session status is Faltou
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$;

-- 4. Update get_performance_report RPC to map 'Faltou' as missed_sessions and update absenteeism rate
CREATE OR REPLACE FUNCTION public.get_performance_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Total de grupos (linhas no relatório)
  SELECT count(*) INTO v_total
  FROM (
    SELECT c.id, prof.id
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.id, prof.id
  ) groups;

  SELECT json_agg(stats) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      prof.name as professional_name,
      COUNT(s.id) FILTER (WHERE s.status = 'Realizada') as completed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Faltou') as missed_sessions,
      COUNT(s.id) FILTER (WHERE s.status IN ('Pendente', 'Não Realizado')) as pending_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Glosado') as denied_sessions,
      SUM(proc.valor_total) FILTER (WHERE s.status = 'Realizada') as total_value,
      ROUND((COUNT(s.id) FILTER (WHERE s.status = 'Faltou')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100), 2) as absenteeism_rate
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, prof.name
    ORDER BY total_value DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  ) stats;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$$;
