-- =========================================================================
-- MIGRATION: Adiciona desmembramento de recursos (SUS vs RP) no Relatório de Faturamento
-- =========================================================================

-- 1. Atualizar overload com paginação (9 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT 'official'::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
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


-- 2. Atualizar overload sem paginação (7 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT 'official'::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
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
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;
