-- Drop the view first to allow changing definition options
DROP VIEW IF EXISTS public.view_competence_billing_sums;

-- Recreate the view with security_invoker = true to respect RLS
CREATE OR REPLACE VIEW public.view_competence_billing_sums 
WITH (security_invoker = true) 
AS
SELECT 
  a.clinic_id,
  a.month_year,
  COALESCE(SUM(COALESCE(cpp.valor_sus, proc.valor_sus)), 0) as total_sus,
  COALESCE(SUM(COALESCE(cpp.valor_rp, proc.valor_rp)), 0) as total_rp,
  COALESCE(SUM(COALESCE(cpp.valor_total, proc.valor_total)), 0) as total_value
FROM attendance_sessions s
JOIN attendances a ON s.attendance_id = a.id
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
GROUP BY a.clinic_id, a.month_year;
