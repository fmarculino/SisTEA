-- Migration: Fix search path and target column for patient PIN hashing and verification
-- Description: Resolves "function gen_salt(unknown) does not exist" and "function crypt(text, text) does not exist" errors
-- by adding the "extensions" schema to the search_path. Also fixes verify_patient_pin to query "pin_hash" instead of "auth_token".

-- 1. Fix trigger function hash_patient_pin search path
CREATE OR REPLACE FUNCTION public.hash_patient_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_token IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.auth_token IS DISTINCT FROM NEW.auth_token) THEN
    NEW.pin_hash := crypt(NEW.auth_token, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 2. Fix RPC function verify_patient_pin search path and query target column
CREATE OR REPLACE FUNCTION public.verify_patient_pin(
  p_patient_id UUID,
  p_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- We query pin_hash (which contains the bcrypt hash) instead of auth_token (which contains the plain text token)
  SELECT pin_hash INTO v_hash
  FROM public.patients
  WHERE id = p_patient_id;
  
  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Crypt will check the pin against the bcrypt hash securely
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;
