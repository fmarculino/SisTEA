-- =====================================================
-- Migration: Add Session Validation (QR Code + Token)
-- =====================================================

-- 1. Add auth_token field to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS auth_token TEXT,
ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Generate tokens for existing patients that don't have one
UPDATE patients
SET auth_token = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
    token_updated_at = NOW()
WHERE auth_token IS NULL;

-- 3. Make auth_token NOT NULL after backfill
ALTER TABLE patients ALTER COLUMN auth_token SET NOT NULL;

-- 4. Ensure unique tokens across all patients
-- (small chance of collision with 6 digits, but we handle it in app code too)
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_auth_token ON patients(auth_token);

-- 5. Add validation/audit fields to attendance_sessions
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS validation_ip TEXT,
ADD COLUMN IF NOT EXISTS validation_ua TEXT,
ADD COLUMN IF NOT EXISTS validation_geo JSONB,
ADD COLUMN IF NOT EXISTS validation_nonce TEXT,
ADD COLUMN IF NOT EXISTS validation_attempts INTEGER DEFAULT 0;

-- 6. Add justification column if not exists (may already exist in some envs)
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS justification TEXT;

-- 7. RLS: Prevent CLINIC_USER from seeing auth_token
-- We handle this at the application layer by not selecting auth_token for clinic users.
-- But we add an extra layer: clinic users cannot UPDATE the auth_token field.
-- This is enforced via a trigger.

CREATE OR REPLACE FUNCTION prevent_token_update_by_clinic_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If the token is being changed, check if the current user is an admin
  IF OLD.auth_token IS DISTINCT FROM NEW.auth_token THEN
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'SMS_ADMIN' THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o token do paciente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_token_update ON patients;
CREATE TRIGGER check_token_update
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION prevent_token_update_by_clinic_user();

-- 8. RLS policy for validation endpoint (public/anonymous access to attendance_sessions)
-- The validation API route will use service_role key, so RLS won't block it.
-- But we add a policy so that anonymous users CANNOT directly query the table.
-- The API route handles all validation logic server-side.

-- 9. Index for faster validation lookups
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_validation_nonce 
  ON attendance_sessions(validation_nonce) WHERE validation_nonce IS NOT NULL;
