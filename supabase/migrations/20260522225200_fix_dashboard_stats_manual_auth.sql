-- Fix get_dashboard_stats to exclude MANUAL_AUTH from digital_validated count
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_clinic_id uuid, p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_attendances', COUNT(DISTINCT a.id),
    'total_sessions', COUNT(s.id),
    'total_value', COALESCE(SUM(p.valor_total), 0),
    'digital_validated', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL AND (s.validation_type IS NULL OR s.validation_type != 'MANUAL_AUTH')),
    'clinic_stats', (
      SELECT COALESCE(json_agg(stats), '[]'::json)
      FROM (
        SELECT 
          c.name,
          COUNT(s2.id) as count,
          COUNT(DISTINCT a2.id) as attendance_count,
          COALESCE(SUM(p2.valor_total), 0) as value
        FROM attendance_sessions s2
        JOIN attendances a2 ON s2.attendance_id = a2.id
        JOIN clinics c ON a2.clinic_id = c.id
        JOIN procedures p2 ON a2.procedure_id = p2.id
        WHERE s2.status = 'Realizada'
        AND (p_clinic_id IS NULL OR a2.clinic_id = p_clinic_id)
        AND (p_start_date IS NULL OR s2.session_date >= p_start_date)
        AND (p_end_date IS NULL OR s2.session_date <= p_end_date)
        GROUP BY c.name
        ORDER BY SUM(p2.valor_total) DESC
      ) stats
    )
  ) INTO v_result
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  JOIN procedures p ON a.procedure_id = p.id
  WHERE s.status = 'Realizada'
  AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  AND (p_start_date IS NULL OR s.session_date >= p_start_date)
  AND (p_end_date IS NULL OR s.session_date <= p_end_date);

  RETURN v_result;
END;
$function$;
