-- Migration: Fix Row Level Security policies for attendance_sessions
-- Description: Drop obsolete roles-based policies and replace with group-aware policies based on linked attendances.

-- 1. Drop existing obsolete/broken policies
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "SMS_ADMIN full access sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Clinic users view group sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Clinic users insert group sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Clinic users update group sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Clinic users delete group sessions" ON public.attendance_sessions;

-- 2. Create group-aware SELECT policy
CREATE POLICY "Clinic users view group sessions" ON public.attendance_sessions
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.attendances a
    WHERE a.id = attendance_sessions.attendance_id
      AND public.user_can_access_clinic(a.clinic_id)
  )
);

-- 3. Create group-aware INSERT policy
CREATE POLICY "Clinic users insert group sessions" ON public.attendance_sessions
FOR INSERT WITH CHECK (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.attendances a
    WHERE a.id = attendance_sessions.attendance_id
      AND public.user_can_access_clinic(a.clinic_id)
  )
);

-- 4. Create group-aware UPDATE policy
CREATE POLICY "Clinic users update group sessions" ON public.attendance_sessions
FOR UPDATE USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.attendances a
    WHERE a.id = attendance_sessions.attendance_id
      AND public.user_can_access_clinic(a.clinic_id)
  )
);

-- 5. Create group-aware DELETE policy
CREATE POLICY "Clinic users delete group sessions" ON public.attendance_sessions
FOR DELETE USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.attendances a
    WHERE a.id = attendance_sessions.attendance_id
      AND public.user_can_access_clinic(a.clinic_id)
  )
);
