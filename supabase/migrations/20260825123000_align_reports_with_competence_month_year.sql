-- =========================================================================
-- MIGRATION: Alinhamento de Relatórios de Faturamento com a Competência (month_year)
-- =========================================================================

-- 1. Atualizar RPC get_billing_report para suportar p_month_year
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT 'official'::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_month_year text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (
      (p_month_year IS NOT NULL AND a.month_year = p_month_year)
      OR
      (p_month_year IS NULL AND (p_start_date IS NULL OR s.session_date >= p_start_date) AND (p_end_date IS NULL OR s.session_date <= p_end_date))
    )
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
    AND (
      CASE 
        WHEN p_mode = 'official' THEN s.status = 'Realizada'
        WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
        ELSE TRUE 
      END
    );

  -- Busca dos dados com limite/offset e cálculo de desmembramento SUS e Recurso Próprio (RP)
  SELECT json_agg(rows) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      COALESCE(cpp.valor_sus, proc.valor_sus) as valor_sus,
      COALESCE(cpp.valor_rp, proc.valor_rp) as valor_rp,
      COALESCE(cpp.valor_total, proc.valor_total) as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    LEFT JOIN LATERAL (
      SELECT valor_sus, valor_rp, valor_total
      FROM clinic_procedure_prices cpp
      WHERE cpp.clinic_id = a.clinic_id
        AND cpp.procedure_id = a.procedure_id
        AND cpp.active = true
        AND cpp.valid_from <= s.session_date
        AND (cpp.valid_to IS NULL OR cpp.valid_to >= s.session_date)
      ORDER BY cpp.valid_from DESC
      LIMIT 1
    ) cpp ON TRUE
    WHERE (
        (p_month_year IS NOT NULL AND a.month_year = p_month_year)
        OR
        (p_month_year IS NULL AND (p_start_date IS NULL OR s.session_date >= p_start_date) AND (p_end_date IS NULL OR s.session_date <= p_end_date))
      )
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
    LIMIT p_limit
    OFFSET p_offset
  ) rows;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$function$;

-- 2. Atualizar get_performance_report para suportar p_month_year
CREATE OR REPLACE FUNCTION public.get_performance_report(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_month_year TEXT DEFAULT NULL
) RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total
  FROM (
    SELECT c.id, prof.id
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    WHERE (
        (p_month_year IS NOT NULL AND a.month_year = p_month_year)
        OR
        (p_month_year IS NULL AND (p_start_date IS NULL OR s.session_date >= p_start_date) AND (p_end_date IS NULL OR s.session_date <= p_end_date))
      )
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
    WHERE (
        (p_month_year IS NOT NULL AND a.month_year = p_month_year)
        OR
        (p_month_year IS NULL AND (p_start_date IS NULL OR s.session_date >= p_start_date) AND (p_end_date IS NULL OR s.session_date <= p_end_date))
      )
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
