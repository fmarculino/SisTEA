-- Migration: Create verify_patient_pin RPC function
-- Description: Verifies a patient PIN against the bcrypt hash stored in public.patients.auth_token.
-- Secure Context: Executed as SECURITY DEFINER with search_path set.

CREATE OR REPLACE FUNCTION public.verify_patient_pin(
  p_patient_id UUID,
  p_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT auth_token INTO v_hash
  FROM public.patients
  WHERE id = p_patient_id;
  
  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificação do PIN contra o hash criptográfico (bcrypt)
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
