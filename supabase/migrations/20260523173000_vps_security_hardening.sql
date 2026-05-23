-- Migration: VPS Security Hardening
-- Description: Enables RLS on logs and metadata, configures views with security_invoker, and sets search_path on all functions.

-- 1. Enable RLS on public.system_metadata
ALTER TABLE public.system_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON public.system_metadata;
DROP POLICY IF EXISTS "Allow update for SMS_ADMIN" ON public.system_metadata;

CREATE POLICY "Allow read access to all authenticated users"
ON public.system_metadata FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow update for SMS_ADMIN"
ON public.system_metadata FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
        AND public.users.role = 'SMS_ADMIN'
    )
);

-- 2. Enable RLS on public.competence_audit_logs
ALTER TABLE public.competence_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SMS_ADMIN full read competence_audit_logs" ON public.competence_audit_logs;
DROP POLICY IF EXISTS "Allow clinic_user read own competence_audit_logs" ON public.competence_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert competence_audit_logs" ON public.competence_audit_logs;

CREATE POLICY "Allow SMS_ADMIN full read competence_audit_logs"
ON public.competence_audit_logs FOR SELECT
TO authenticated
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "Allow clinic_user read own competence_audit_logs"
ON public.competence_audit_logs FOR SELECT
TO authenticated
USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Allow authenticated insert competence_audit_logs"
ON public.competence_audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  (public.get_user_role() = 'SMS_ADMIN') OR 
  (clinic_id = public.get_user_clinic_id())
);

-- 3. Recreate public.view_competence_billing_sums WITH (security_invoker = true)
DROP VIEW IF EXISTS public.view_competence_billing_sums;

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

-- 4. Dynamically set search_path on all public functions to mitigate search-path mutability hijacking
DO $$
DECLARE
    r RECORD;
    v_sql TEXT;
BEGIN
    FOR r IN 
        SELECT 
            p.proname,
            pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
    LOOP
        v_sql := format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp', r.proname, r.args);
        BEGIN
            EXECUTE v_sql;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not set search_path for function public.%I(%s): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
END $$;
