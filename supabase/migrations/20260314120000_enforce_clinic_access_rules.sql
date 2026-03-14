-- Fix Data Access Rules for Patients, Professionals, and Linkages

-- 1. Patients Policies
DROP POLICY IF EXISTS "View patients" ON public.patients;
DROP POLICY IF EXISTS "Insert patients" ON public.patients;
DROP POLICY IF EXISTS "Update patients" ON public.patients;
DROP POLICY IF EXISTS "Admin delete patients" ON public.patients;
DROP POLICY IF EXISTS "SMS_ADMIN full access patients" ON public.patients;
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON public.patients;

CREATE POLICY "SMS_ADMIN full access patients" 
ON public.patients FOR ALL 
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER manage own clinic patients" 
ON public.patients FOR ALL 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  clinic_id = public.get_user_clinic_id()
);

-- 2. Professionals Policies
DROP POLICY IF EXISTS "View professionals" ON public.professionals;
DROP POLICY IF EXISTS "Admin full access professionals" ON public.professionals;
DROP POLICY IF EXISTS "SMS_ADMIN full access professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER view own clinic professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER update professionals" ON public.professionals;

CREATE POLICY "SMS_ADMIN full access professionals" 
ON public.professionals FOR ALL 
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER view own clinic professionals" 
ON public.professionals FOR SELECT 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = id AND pc.clinic_id = public.get_user_clinic_id()
  )
);

CREATE POLICY "CLINIC_USER update professionals" 
ON public.professionals FOR UPDATE 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = id AND pc.clinic_id = public.get_user_clinic_id()
  )
);

-- We allow INSERT globally for ANY authenticated user because professionals are inserted without clinic associations initially. 
-- Their access is later restricted by professional_clinics. 
CREATE POLICY "CLINIC_USER insert professionals" 
ON public.professionals FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 3. Professional Clinics
ALTER TABLE public.professional_clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SMS_ADMIN full access professional_clinics" ON public.professional_clinics;
DROP POLICY IF EXISTS "CLINIC_USER manage own professional_clinics" ON public.professional_clinics;
DROP POLICY IF EXISTS "View professional_clinics" ON public.professional_clinics;
DROP POLICY IF EXISTS "Insert professional_clinics" ON public.professional_clinics;
DROP POLICY IF EXISTS "Update professional_clinics" ON public.professional_clinics;
DROP POLICY IF EXISTS "Delete professional_clinics" ON public.professional_clinics;

CREATE POLICY "SMS_ADMIN full access professional_clinics" 
ON public.professional_clinics FOR ALL 
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER manage own professional_clinics" 
ON public.professional_clinics FOR ALL 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  clinic_id = public.get_user_clinic_id()
);

-- 4. Professional Specialties
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SMS_ADMIN full access professional_specialties" ON public.professional_specialties;
DROP POLICY IF EXISTS "CLINIC_USER manage own professional_specialties" ON public.professional_specialties;
DROP POLICY IF EXISTS "View professional_specialties" ON public.professional_specialties;
DROP POLICY IF EXISTS "Insert professional_specialties" ON public.professional_specialties;
DROP POLICY IF EXISTS "Update professional_specialties" ON public.professional_specialties;
DROP POLICY IF EXISTS "Delete professional_specialties" ON public.professional_specialties;

CREATE POLICY "SMS_ADMIN full access professional_specialties" 
ON public.professional_specialties FOR ALL 
USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER manage own professional_specialties" 
ON public.professional_specialties FOR ALL 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = professional_id AND pc.clinic_id = public.get_user_clinic_id()
  )
)
WITH CHECK (
  public.get_user_role() = 'CLINIC_USER'
);
