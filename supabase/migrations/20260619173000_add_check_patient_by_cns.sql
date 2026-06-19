-- Migration: Add check_patient_by_cns function
-- Description: Creates a security definer function to query patients by CNS, bypassing RLS to allow clinic users to link existing patients.

CREATE OR REPLACE FUNCTION public.check_patient_by_cns(p_cns TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  birth_date DATE,
  mother_name TEXT,
  cns_patient TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.birth_date,
    p.mother_name,
    p.cns_patient
  FROM public.patients p
  WHERE regexp_replace(p.cns_patient, '[^0-9]', '', 'g') = regexp_replace(p_cns, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limit execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.check_patient_by_cns(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.check_patient_by_cns(TEXT) TO authenticated;
