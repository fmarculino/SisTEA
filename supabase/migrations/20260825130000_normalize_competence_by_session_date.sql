-- =========================================================================
-- MIGRATION: Normalização Integral da Governança de Competências por session_date
-- =========================================================================

-- 1. Função utilitária para calcular a competência (MM/YYYY) com base na data da sessão e no dia de corte da clínica
CREATE OR REPLACE FUNCTION public.calculate_competence_month_year(p_date date, p_end_day integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day integer;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;
  v_day := EXTRACT(DAY FROM p_date);
  IF p_end_day IS NOT NULL AND p_end_day >= 1 AND p_end_day < 31 AND v_day > p_end_day THEN
    RETURN TO_CHAR(p_date + INTERVAL '1 month', 'MM/YYYY');
  ELSE
    RETURN TO_CHAR(p_date, 'MM/YYYY');
  END IF;
END;
$$;

-- 2. Recriar View view_competence_billing_sums agrupando por data de sessão real
DROP VIEW IF EXISTS public.view_competence_billing_sums;

CREATE OR REPLACE VIEW public.view_competence_billing_sums 
WITH (security_invoker = true) 
AS
SELECT 
  a.clinic_id,
  public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) as month_year,
  COALESCE(SUM(COALESCE(cpp.valor_sus, proc.valor_sus)), 0) as total_sus,
  COALESCE(SUM(COALESCE(cpp.valor_rp, proc.valor_rp)), 0) as total_rp,
  COALESCE(SUM(COALESCE(cpp.valor_total, proc.valor_total)), 0) as total_value
FROM attendance_sessions s
JOIN attendances a ON s.attendance_id = a.id
JOIN clinics c ON a.clinic_id = c.id
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
WHERE s.status = 'Realizada'
GROUP BY a.clinic_id, public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31));

-- 3. Atualizar RPC get_billing_report para filtrar por competência da sessão
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
  -- Contagem total
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  JOIN clinics c ON a.clinic_id = c.id
  WHERE (
      (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) = p_month_year)
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

  -- Dados agregados
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
        (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) = p_month_year)
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

-- 4. Atualizar RPC get_performance_report para filtrar por competência da sessão
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
        (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) = p_month_year)
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
        (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) = p_month_year)
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

-- 5. Atualizar RPC get_dashboard_stats para suportar p_month_year e desmembramento correto de preços contratuais
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_clinic_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_month_year text DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_attendances', COUNT(DISTINCT a.id),
    'total_sessions', COUNT(s.id),
    'total_value', COALESCE(SUM(COALESCE(cpp.valor_total, p.valor_total)), 0),
    'digital_validated', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL AND (s.validation_type IS NULL OR s.validation_type != 'MANUAL_AUTH')),
    'clinic_stats', (
      SELECT COALESCE(json_agg(stats), '[]'::json)
      FROM (
        SELECT 
          c2.name,
          COUNT(s2.id) as count,
          COUNT(DISTINCT a2.id) as attendance_count,
          COALESCE(SUM(COALESCE(cpp2.valor_total, p2.valor_total)), 0) as value
        FROM attendance_sessions s2
        JOIN attendances a2 ON s2.attendance_id = a2.id
        JOIN clinics c2 ON a2.clinic_id = c2.id
        JOIN procedures p2 ON a2.procedure_id = p2.id
        LEFT JOIN LATERAL (
          SELECT valor_total
          FROM clinic_procedure_prices cpp_lat
          WHERE cpp_lat.clinic_id = a2.clinic_id
            AND cpp_lat.procedure_id = a2.procedure_id
            AND cpp_lat.active = true
            AND cpp_lat.valid_from <= s2.session_date
            AND (cpp_lat.valid_to IS NULL OR cpp_lat.valid_to >= s2.session_date)
          ORDER BY cpp_lat.valid_from DESC
          LIMIT 1
        ) cpp2 ON TRUE
        WHERE s2.status = 'Realizada'
        AND (p_clinic_id IS NULL OR a2.clinic_id = p_clinic_id)
        AND (
          (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s2.session_date, COALESCE(c2.competence_end_day, 31)) = p_month_year)
          OR
          (p_month_year IS NULL AND (p_start_date IS NULL OR s2.session_date >= p_start_date) AND (p_end_date IS NULL OR s2.session_date <= p_end_date))
        )
        GROUP BY c2.name
        ORDER BY SUM(COALESCE(cpp2.valor_total, p2.valor_total)) DESC
      ) stats
    )
  ) INTO v_result
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  JOIN clinics c ON a.clinic_id = c.id
  JOIN procedures p ON a.procedure_id = p.id
  LEFT JOIN LATERAL (
    SELECT valor_total
    FROM clinic_procedure_prices cpp_lat
    WHERE cpp_lat.clinic_id = a.clinic_id
      AND cpp_lat.procedure_id = a.procedure_id
      AND cpp_lat.active = true
      AND cpp_lat.valid_from <= s.session_date
      AND (cpp_lat.valid_to IS NULL OR cpp_lat.valid_to >= s.session_date)
    ORDER BY cpp_lat.valid_from DESC
    LIMIT 1
  ) cpp ON TRUE
  WHERE s.status = 'Realizada'
  AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  AND (
    (p_month_year IS NOT NULL AND public.calculate_competence_month_year(s.session_date, COALESCE(c.competence_end_day, 31)) = p_month_year)
    OR
    (p_month_year IS NULL AND (p_start_date IS NULL OR s.session_date >= p_start_date) AND (p_end_date IS NULL OR s.session_date <= p_end_date))
  );

  RETURN v_result;
END;
$function$;
