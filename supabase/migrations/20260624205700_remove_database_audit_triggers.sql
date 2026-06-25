-- Remove automatic audit triggers that log duplicate database operations
DROP TRIGGER IF EXISTS audit_patients ON public.patients;
DROP TRIGGER IF EXISTS audit_attendance_sessions ON public.attendance_sessions;
DROP FUNCTION IF EXISTS public.audit_trigger_func();
