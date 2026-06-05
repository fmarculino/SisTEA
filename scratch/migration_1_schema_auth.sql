-- ==============================================================
-- SisTEA Migration - Part 1: Schema & Authentication
-- Generated on: 2026-05-22T22:17:35.002Z
-- ==============================================================

-- 1. Enable baseline extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1.5. Create supabase_migrations schema and table
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    statements TEXT[] NOT NULL,
    created_by TEXT,
    idempotency_key TEXT,
    rollback TEXT[]
);

SET session_replication_role = 'replica';

-- 2. Executing Migrations in Chronological Order to Build Schema
-- Migration: 20260313000227_initial_schema
-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Clínicas
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnes TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Usuários (Extende auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('SMS_ADMIN', 'CLINIC_USER')),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Restrição: Usuários de clínica precisam estar vinculados a uma clínica.
ALTER TABLE public.users ADD CONSTRAINT clinic_user_must_have_clinic CHECK (
    (role = 'SMS_ADMIN') OR 
    (role = 'CLINIC_USER' AND clinic_id IS NOT NULL)
);

-- 4. Tabela de Profissionais
CREATE TABLE public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cns TEXT NOT NULL UNIQUE,
    cbo TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Pacientes
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cns_patient TEXT NOT NULL UNIQUE,
    mother_name TEXT,
    address TEXT,
    city TEXT,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT,
    race_color TEXT,
    cep TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Procedimentos
CREATE TABLE public.procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    valor_sus NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_rp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(10, 2) GENERATED ALWAYS AS (valor_sus + valor_rp) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabela de Atendimentos (Frequência)
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    cid TEXT NOT NULL,
    auth_number TEXT,
    month_year TEXT NOT NULL, -- Exemplo: '03/2026' ou '2026-03'
    status TEXT NOT NULL CHECK (status IN ('REALIZADO', 'GLOSADO', 'PENDENTE')) DEFAULT 'PENDENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_time CHECK (start_time < end_time)
);

--=========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
--=========================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id() RETURNS UUID AS $$
  SELECT clinic_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies: Clinics
CREATE POLICY "Admin full access clinics" ON public.clinics FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');
CREATE POLICY "Users view own clinic" ON public.clinics FOR SELECT USING (id = public.get_user_clinic_id());

-- Policies: Users
CREATE POLICY "Admin full access users" ON public.users FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');
CREATE POLICY "Users view users from same clinic" ON public.users FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- Policies: Professionals
CREATE POLICY "View professionals" ON public.professionals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access professionals" ON public.professionals FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

-- Policies: Patients
CREATE POLICY "View patients" ON public.patients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert patients" ON public.patients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Update patients" ON public.patients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete patients" ON public.patients FOR DELETE USING (public.get_user_role() = 'SMS_ADMIN');

-- Policies: Procedures
CREATE POLICY "View procedures" ON public.procedures FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full procedures" ON public.procedures FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

-- Policies: Attendances
CREATE POLICY "Admin full attendances" ON public.attendances FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');
CREATE POLICY "Clinic users view own attendances" ON public.attendances FOR SELECT USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users insert own attendances" ON public.attendances FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users update own attendances" ON public.attendances FOR UPDATE USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users delete own attendances" ON public.attendances FOR DELETE USING (clinic_id = public.get_user_clinic_id());

-- Patch: Create missing audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    user_id UUID,
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    description TEXT
);

-- Patch: Create missing competence_audit_logs table
CREATE TABLE IF NOT EXISTS public.competence_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Patch: Create missing system_metadata table
CREATE TABLE IF NOT EXISTS public.system_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_version TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Patch: Add missing active column and other address/demographic columns to public.patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address_neighborhood TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ibge_code TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- Patch: Add missing columns to clinics, procedures, and attendances
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS orgao_emissor TEXT;
ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS bpa_type TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- Migration: 20260313005618_add_clinic_fields
ALTER TABLE public.clinics DROP COLUMN IF EXISTS cnes CASCADE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS cnpj TEXT UNIQUE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS corporate_name TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS email TEXT;
NOTIFY pgrst, 'reload schema';

-- Migration: 20260313010616_add_cnes_to_clinics_v2
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS cnes TEXT;
NOTIFY pgrst, 'reload schema';

-- Migration: 20260313011850_add_specialties_and_fix_professionals
-- Nova tabela de Especialidades
CREATE TABLE public.specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cbo TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Especialidades
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Políticas para Especialidades
CREATE POLICY "View specialties" ON public.specialties FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access specialties" ON public.specialties FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

-- Ajustes na tabela de Profissionais
ALTER TABLE public.professionals 
  ADD COLUMN IF NOT EXISTS specialty_id UUID REFERENCES public.specialties(id),
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Remover restrições de CNS e CBO (tornar opcional e remover UNIQUE de CNS se existir para bater com o Form)
ALTER TABLE public.professionals ALTER COLUMN cns DROP NOT NULL;
ALTER TABLE public.professionals DROP CONSTRAINT IF EXISTS professionals_cns_key;
ALTER TABLE public.professionals ALTER COLUMN cbo DROP NOT NULL;

-- Migration: 20260313013457_add_name_and_active_to_procedures
ALTER TABLE public.procedures ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.procedures ALTER COLUMN name DROP DEFAULT;
ALTER TABLE public.procedures ADD COLUMN active BOOLEAN DEFAULT true;

-- Migration: 20260313014547_add_missing_patient_columns
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS medical_record_number TEXT,
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

-- Log de migração concluído;

-- Migration: 20260313021410_add_notes_and_value_to_attendances
ALTER TABLE public.attendances 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS value_applied NUMERIC DEFAULT 0;

-- Atualizar constraint de status para incluir os valores do frontend
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
ALTER TABLE public.attendances 
ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY['REALIZADO'::text, 'GLOSADO'::text, 'PENDENTE'::text, 'present'::text, 'absent_justified'::text, 'absent_unjustified'::text]));

-- Migration: 20260313021425_make_attendance_columns_nullable_and_update_status
-- Tornar colunas não presentes no formulário no momento opcionais no banco
ALTER TABLE public.attendances 
ALTER COLUMN start_time DROP NOT NULL,
ALTER COLUMN end_time DROP NOT NULL,
ALTER COLUMN cid DROP NOT NULL,
ALTER COLUMN month_year DROP NOT NULL;

-- Garantir que a coluna status aceite os valores do frontend se ainda não estiver correto
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
ALTER TABLE public.attendances 
ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY['REALIZADO'::text, 'GLOSADO'::text, 'PENDENTE'::text, 'present'::text, 'absent_justified'::text, 'absent_unjustified'::text]));

-- Migration: 20260313030737_professional_clinics_m2m
-- 1. Create the junction table
CREATE TABLE public.professional_clinics (
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, clinic_id)
);

-- 2. Migrate existing associations
INSERT INTO public.professional_clinics (professional_id, clinic_id)
SELECT id, clinic_id FROM public.professionals WHERE clinic_id IS NOT NULL;

-- 3. Drop the clinic_id column from professionals
ALTER TABLE public.professionals DROP COLUMN clinic_id;

-- 4. Enable RLS on the new table
ALTER TABLE public.professional_clinics ENABLE ROW LEVEL SECURITY;

-- 5. Policies for professional_clinics
CREATE POLICY "Admin full access professional_clinics" ON public.professional_clinics FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');
CREATE POLICY "Clinic users view professional_clinics from same clinic" ON public.professional_clinics FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- 6. Update professionals RLS policies
-- Since professionals are now shared across clinics, let's ensure clinic users can still see them if associated.
-- The existing policy "View professionals" is: auth.role() = 'authenticated'
-- If we want to restrict it:
-- DROP POLICY "View professionals" ON public.professionals;
-- CREATE POLICY "View professionals" ON public.professionals FOR SELECT 
-- USING (
--   public.get_user_role() = 'SMS_ADMIN' OR 
--   EXISTS (
--     SELECT 1 FROM public.professional_clinics pc 
--     WHERE pc.professional_id = public.professionals.id 
--     AND pc.clinic_id = public.get_user_clinic_id()
--   )
-- );
-- But wait, get_user_role/clinic_id might not be defined for everyone yet.
-- I'll check if those functions exist.;

-- Migration: 20260313033744_add_frequency_control_sessions
-- Add missing columns to attendances (acting as the main Frequency Control sheet)
ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS authorization_date date,
ADD COLUMN IF NOT EXISTS authorized_quantity integer NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS attendance_character text;

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    attendance_id uuid NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
    session_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status text NOT NULL DEFAULT 'Realizada',
    created_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id)
);

-- RLS Policies for attendance_sessions
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."attendance_sessions";
CREATE POLICY "Enable read access for all users" ON "public"."attendance_sessions"
FOR SELECT USING (true);

-- Insert policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."attendance_sessions"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update policies
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable update for authenticated users only" ON "public"."attendance_sessions"
FOR UPDATE USING (auth.role() = 'authenticated');

-- Delete policies
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable delete for authenticated users only" ON "public"."attendance_sessions"
FOR DELETE USING (auth.role() = 'authenticated');

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON attendance_sessions;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migration: 20260313132338_add_active_to_users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Migration: 20260313135926_add_active_to_specialties
ALTER TABLE public.specialties ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Migration: 20260313140717_add_cpf_to_professionals
ALTER TABLE public.professionals ADD COLUMN cpf TEXT UNIQUE;
-- CNS is already unique, but let's make sure it's enforced if it wasn't
ALTER TABLE public.professionals ADD CONSTRAINT professionals_cns_key UNIQUE (cns);

-- Migration: 20260313141621_professional_multiple_specialties
CREATE TABLE public.professional_specialties (
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, specialty_id)
);

-- Enable RLS
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View professional_specialties" ON public.professional_specialties FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access professional_specialties" ON public.professional_specialties FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

-- Migrate existing data from professionals.specialty_id
INSERT INTO public.professional_specialties (professional_id, specialty_id)
SELECT id, specialty_id FROM public.professionals WHERE specialty_id IS NOT NULL;

-- Migration: 20260313150638_add_procedure_specialties_v2
CREATE TABLE IF NOT EXISTS public.procedure_specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(procedure_id, specialty_id)
);

-- Enable RLS
ALTER TABLE public.procedure_specialties ENABLE ROW LEVEL SECURITY;

-- Basic Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'procedure_specialties' AND policyname = 'Allow all on procedure_specialties') THEN
        CREATE POLICY "Allow all on procedure_specialties" ON public.procedure_specialties FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Migration: 20260313200857_allow_null_procedure_code
ALTER TABLE public.procedures ALTER COLUMN code DROP NOT NULL;

-- Migration: 20260313205203_fix_professionals_rls_for_clinic_users
-- Enable insert/update for authenticated users on professionals
CREATE POLICY "Insert professionals authenticated" ON public.professionals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update professionals authenticated" ON public.professionals FOR UPDATE TO authenticated USING (true);

-- Enable management of clinic associations
CREATE POLICY "Insert professional_clinics authenticated" ON public.professional_clinics FOR INSERT TO authenticated WITH CHECK (
  (get_user_role() = 'SMS_ADMIN') OR (clinic_id = get_user_clinic_id())
);
CREATE POLICY "Delete professional_clinics authenticated" ON public.professional_clinics FOR DELETE TO authenticated USING (
  (get_user_role() = 'SMS_ADMIN') OR (clinic_id = get_user_clinic_id())
);

-- Enable management of specialty associations
CREATE POLICY "Insert professional_specialties authenticated" ON public.professional_specialties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete professional_specialties authenticated" ON public.professional_specialties FOR DELETE TO authenticated USING (true);

-- Migration: 20260326145705_add_justification_to_attendance_sessions
ALTER TABLE public.attendance_sessions ADD COLUMN justification TEXT;

-- Migration: 20260430022831_add_clinic_contracts_and_competences
-- 1. Add closing_day to clinics
ALTER TABLE clinics ADD COLUMN closing_day INTEGER DEFAULT 25;

-- 2. Create clinic_procedure_prices table
CREATE TABLE clinic_procedure_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
    valor_sus NUMERIC NOT NULL DEFAULT 0,
    valor_rp NUMERIC NOT NULL DEFAULT 0,
    valor_total NUMERIC GENERATED ALWAYS AS (valor_sus + valor_rp) STORED,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT clinic_procedure_dates_check CHECK (valid_to IS NULL OR valid_from <= valid_to)
);

ALTER TABLE clinic_procedure_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access procedure prices" ON clinic_procedure_prices
  FOR ALL USING (get_user_role() = 'SMS_ADMIN');

CREATE POLICY "Users view own clinic procedure prices" ON clinic_procedure_prices
  FOR SELECT USING (clinic_id = get_user_clinic_id());

-- 3. Create competences table
CREATE TABLE competences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'FECHADA')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(clinic_id, month, year)
);

ALTER TABLE competences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access competences" ON competences
  FOR ALL USING (get_user_role() = 'SMS_ADMIN');

CREATE POLICY "Users view own clinic competences" ON competences
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Users update own clinic competences" ON competences
  FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- Also allow inserting in case they create it upon closing
CREATE POLICY "Users insert own clinic competences" ON competences
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());

-- Migration: 20260430025446_update_contracts_for_bulk
ALTER TABLE clinic_procedure_prices 
ADD COLUMN contract_number TEXT,
ADD COLUMN active BOOLEAN DEFAULT TRUE;

-- Migration: 20260430032857_add_competence_days_to_clinics
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS competence_end_day INTEGER DEFAULT 31,
ADD COLUMN IF NOT EXISTS competence_deadline_day INTEGER DEFAULT 5;

-- Migration: 20260502221112_add_session_validation
-- Add auth_token field to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS auth_token TEXT,
ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Generate tokens for existing patients that don't have one
UPDATE patients
SET auth_token = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
    token_updated_at = NOW()
WHERE auth_token IS NULL;

-- Make auth_token NOT NULL after backfill
ALTER TABLE patients ALTER COLUMN auth_token SET NOT NULL;

-- Ensure unique tokens across all patients
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_auth_token ON patients(auth_token);

-- Add validation/audit fields to attendance_sessions
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS validation_ip TEXT,
ADD COLUMN IF NOT EXISTS validation_ua TEXT,
ADD COLUMN IF NOT EXISTS validation_geo JSONB,
ADD COLUMN IF NOT EXISTS validation_nonce TEXT,
ADD COLUMN IF NOT EXISTS validation_attempts INTEGER DEFAULT 0;

-- Add justification column if not exists
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS justification TEXT;

-- Trigger to prevent clinic users from modifying tokens
CREATE OR REPLACE FUNCTION prevent_token_update_by_clinic_user()
RETURNS TRIGGER AS $$
BEGIN
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

-- Index for faster validation lookups
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_validation_nonce 
  ON attendance_sessions(validation_nonce) WHERE validation_nonce IS NOT NULL;

-- Migration: 20260503010654_multi_clinic_patient_setup
-- 1. Criar a tabela de junção
CREATE TABLE IF NOT EXISTS patient_clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(patient_id, clinic_id)
);

-- 2. Migrar dados existentes da tabela patients para patient_clinics
INSERT INTO patient_clinics (patient_id, clinic_id, active)
SELECT id, clinic_id, active
FROM patients
WHERE clinic_id IS NOT NULL
ON CONFLICT (patient_id, clinic_id) DO NOTHING;

-- 3. Habilitar RLS na nova tabela
ALTER TABLE patient_clinics ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para patient_clinics
DROP POLICY IF EXISTS "CLINIC_USER see own patient links" ON patient_clinics;
CREATE POLICY "CLINIC_USER see own patient links"
ON patient_clinics FOR SELECT
USING (
    get_user_role() = 'SMS_ADMIN'
    OR clinic_id = get_user_clinic_id()
);

DROP POLICY IF EXISTS "CLINIC_USER insert own patient links" ON patient_clinics;
CREATE POLICY "CLINIC_USER insert own patient links"
ON patient_clinics FOR INSERT
WITH CHECK (
    get_user_role() = 'SMS_ADMIN'
    OR clinic_id = get_user_clinic_id()
);

-- 5. Atualizar as políticas da tabela patients
-- Primeiro removemos a antiga que restringia apenas por patients.clinic_id
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON patients;

-- Nova política de SELECT: Pode ver se for ADMIN ou se houver vínculo na tabela de junção (ou no campo antigo)
CREATE POLICY "CLINIC_USER see linked patients"
ON patients FOR SELECT
USING (
    get_user_role() = 'SMS_ADMIN'
    OR EXISTS (
        SELECT 1 FROM patient_clinics
        WHERE patient_clinics.patient_id = patients.id
        AND patient_clinics.clinic_id = get_user_clinic_id()
    )
    OR patients.clinic_id = get_user_clinic_id()
);

-- Nova política de UPDATE
CREATE POLICY "CLINIC_USER update linked patients"
ON patients FOR UPDATE
USING (
    get_user_role() = 'SMS_ADMIN'
    OR EXISTS (
        SELECT 1 FROM patient_clinics
        WHERE patient_clinics.patient_id = patients.id
        AND patient_clinics.clinic_id = get_user_clinic_id()
    )
    OR patients.clinic_id = get_user_clinic_id()
);

-- Nova política de INSERT: Permite que usuários de clínica insiram novos pacientes
-- A validação de unicidade do CNS continuará barrando duplicatas no banco
CREATE POLICY "CLINIC_USER insert patients"
ON patients FOR INSERT
WITH CHECK (
    get_user_role() = 'SMS_ADMIN'
    OR get_user_role() = 'CLINIC_USER'
);

-- Migration: 20260503013532_add_update_policy_patient_clinics
CREATE POLICY "CLINIC_USER update own patient links"
ON patient_clinics FOR UPDATE
USING (
    get_user_role() = 'SMS_ADMIN'
    OR clinic_id = get_user_clinic_id()
);

-- Migration: 20260503172217_add_clinic_coordinates_v2
-- Add latitude and longitude to clinics table for geofencing
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Comment for documentation
COMMENT ON COLUMN clinics.latitude IS 'Clinic latitude for audit geofencing';
COMMENT ON COLUMN clinics.longitude IS 'Clinic longitude for audit geofencing';

-- Migration: 20260503172303_add_geofencing_fields_to_sessions
-- Add geofencing audit fields to attendance_sessions
ALTER TABLE attendance_sessions 
ADD COLUMN IF NOT EXISTS validation_distance DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS is_out_of_range BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN attendance_sessions.validation_distance IS 'Distance in meters between signature point and clinic';
COMMENT ON COLUMN attendance_sessions.is_out_of_range IS 'True if the distance exceeds the security threshold (e.g. 500m)';

-- Migration: 20260503173557_create_system_settings_v2
-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description)
VALUES 
('enable_token_rotation', 'false', 'Enable automatic patient token rotation after successful validation')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- SMS_ADMIN full access to settings (using public.users table)
CREATE POLICY "SMS_ADMIN full access to settings" 
ON system_settings 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'SMS_ADMIN'
  )
);

-- CLINIC_USER read only access to settings
CREATE POLICY "CLINIC_USER read only access to settings" 
ON system_settings 
FOR SELECT 
TO authenticated 
USING (true);

-- Migration: 20260512014809_fix_security_and_performance_phase_1
-- 1. Unificar Status em attendances
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_status_check;

UPDATE attendances SET status = 'Realizada' WHERE status IN ('REALIZADO', 'present');
UPDATE attendances SET status = 'Pendente' WHERE status IN ('PENDENTE');
UPDATE attendances SET status = 'Glosado' WHERE status IN ('GLOSADO');

ALTER TABLE attendances ADD CONSTRAINT attendances_status_check 
  CHECK (status = ANY (ARRAY['Realizada'::text, 'Pendente'::text, 'Glosado'::text]));

-- 2. Corrigir RLS de Patients (Isolamento de Clínica)
DROP POLICY IF EXISTS "View patients" ON public.patients;
DROP POLICY IF EXISTS "Insert patients" ON public.patients;
DROP POLICY IF EXISTS "Update patients" ON public.patients;
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON public.patients;
DROP POLICY IF EXISTS "SMS_ADMIN full access patients" ON public.patients;

CREATE POLICY "SMS_ADMIN full access patients" 
ON public.patients FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER manage own clinic patients" 
ON public.patients FOR ALL 
USING (public.get_user_role() = 'CLINIC_USER' AND clinic_id = public.get_user_clinic_id());

-- 3. Corrigir RLS de Attendance Sessions (Fim do acesso público)
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."attendance_sessions";

CREATE POLICY "SMS_ADMIN full access sessions" 
ON public.attendance_sessions FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "CLINIC_USER manage own clinic sessions" 
ON public.attendance_sessions FOR ALL 
USING (
  public.get_user_role() = 'CLINIC_USER' AND 
  EXISTS (
    SELECT 1 FROM public.attendances a 
    WHERE a.id = attendance_id AND a.clinic_id = public.get_user_clinic_id()
  )
);

-- 4. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_attendances_clinic_id ON public.attendances(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendances_patient_id ON public.attendances(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendances_attendance_date ON public.attendances(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_attendance_id ON public.attendance_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);

-- Migration: 20260512014903_add_dashboard_stats_rpc
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_clinic_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_attendances', COUNT(s.id),
    'total_value', COALESCE(SUM(p.valor_total), 0),
    'digital_validated', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL),
    'clinic_stats', (
      SELECT COALESCE(json_agg(stats), '[]'::json)
      FROM (
        SELECT 
          c.name,
          COUNT(s2.id) as count,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260512015218_hardening_phase_3_hashing_and_audit
-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Melhorar a segurança da tabela de pacientes
-- Adicionamos uma coluna para o PIN hashado
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Migramos os PINs existentes para o hash (assumindo que auth_token é o PIN atual)
UPDATE public.patients 
SET pin_hash = crypt(auth_token, gen_salt('bf'))
WHERE auth_token IS NOT NULL AND pin_hash IS NULL;

-- 3. Adicionar Triggers de Auditoria Automática (Garante log mesmo via Editor SQL)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    description
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME::text,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::text 
      ELSE NEW.id::text 
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    'Operação automatizada via trigger de banco de dados'
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoria nas tabelas críticas
DROP TRIGGER IF EXISTS audit_patients ON public.patients;
CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_attendance_sessions ON public.attendance_sessions;
CREATE TRIGGER audit_attendance_sessions AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 4. Otimização de busca de usuário (Index em role e active para middleware)
CREATE INDEX IF NOT EXISTS idx_users_active_role ON public.users(active, role);

-- Migration: 20260512015226_auto_hash_pin_trigger
CREATE OR REPLACE FUNCTION hash_patient_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_token IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.auth_token IS DISTINCT FROM NEW.auth_token) THEN
    NEW.pin_hash := crypt(NEW.auth_token, gen_salt('bf'));
    -- Opcional: NEW.auth_token := NULL; -- Se quisermos remover o texto claro imediatamente
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_hash_patient_pin ON public.patients;
CREATE TRIGGER trg_hash_patient_pin 
BEFORE INSERT OR UPDATE ON public.patients 
FOR EACH ROW EXECUTE FUNCTION hash_patient_pin();

-- Migration: 20260512015233_add_verify_pin_rpc
CREATE OR REPLACE FUNCTION verify_patient_pin(
  p_patient_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.patients 
    WHERE id = p_patient_id 
    AND pin_hash = crypt(p_pin, pin_hash)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260512015301_add_report_stats_rpc
CREATE OR REPLACE FUNCTION get_report_stats(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as professional_name,
      p.id as professional_id,
      COUNT(s.id) as session_count,
      SUM(proc.valor_total) as total_value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals p ON a.professional_id = p.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE s.status = 'Realizada'
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    GROUP BY c.name, p.name, p.id
    ORDER BY c.name, SUM(proc.valor_total) DESC
  ) stats;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260512015315_update_report_stats_rpc_clinic_filter
CREATE OR REPLACE FUNCTION get_report_stats(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as professional_name,
      p.id as professional_id,
      COUNT(s.id) as session_count,
      COALESCE(SUM(proc.valor_total), 0) as total_value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals p ON a.professional_id = p.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE s.status = 'Realizada'
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, p.name, p.id
    ORDER BY c.name, SUM(proc.valor_total) DESC
  ) stats;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260512015342_add_app_audit_log_function
CREATE OR REPLACE FUNCTION log_app_event(
  p_action TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    description,
    new_data
  ) VALUES (
    auth.uid(),
    p_action,
    p_description,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260512015403_secure_audit_logs_rls
-- Garantir que a tabela de auditoria seja protegida
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores SMS podem ver logs" ON public.audit_logs;
CREATE POLICY "Apenas administradores SMS podem ver logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'SMS_ADMIN'
);

-- Impedir qualquer modificação manual dos logs
DROP POLICY IF EXISTS "Ninguém pode alterar logs" ON public.audit_logs;
CREATE POLICY "Ninguém pode alterar logs"
ON public.audit_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Permitir inserção via funções SECURITY DEFINER (como log_app_event)
-- Note: Security Definer functions bypass RLS when executing as the owner
-- but if we want to allow direct insert for some reason, we could add a policy.
-- For now, we restrict all direct mutations.;

-- Migration: 20260512224601_fix_attendances_status_constraint_and_default
-- 1. Alterar o valor padrão para 'Pendente' (PascalCase) para alinhar com o restante do sistema
ALTER TABLE public.attendances ALTER COLUMN status SET DEFAULT 'Pendente';

-- 2. Atualizar a restrição de verificação para ser mais flexível (ou apenas alinhar com o PascalCase)
-- Primeiro removemos a antiga
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;

-- Adicionamos a nova, permitindo os valores em PascalCase que o sistema usa
ALTER TABLE public.attendances ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY['Realizada'::text, 'Pendente'::text, 'Glosado'::text, 'REALIZADO'::text, 'PENDENTE'::text, 'GLOSADO'::text]));

-- 3. Garantir que a tabela attendance_sessions também esteja coerente (opcional, mas bom para consistência)
ALTER TABLE public.attendance_sessions ALTER COLUMN status SET DEFAULT 'Pendente';
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;
ALTER TABLE public.attendance_sessions ADD CONSTRAINT attendance_sessions_status_check 
CHECK (status = ANY (ARRAY['Realizada'::text, 'Pendente'::text, 'Glosado'::text]));

-- Migration: 20260512234400_add_attendance_conflict_validation
-- Function to check for attendance session conflicts (BR-001 and BR-002)
CREATE OR REPLACE FUNCTION check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
) RETURNS TEXT AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Get patient and professional for this attendance
  SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
  FROM public.attendances WHERE id = p_attendance_id;

  -- 1. Check Patient Conflict (BR-001)
  -- Checks if this patient is already in another session at the same time
  SELECT 'Paciente já possui atendimento neste horário na clínica ' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-002)
  -- Checks if this professional is already attending someone else at the same time
  SELECT 'O Profissional já possui atendimento neste horário para o paciente ' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$ LANGUAGE plpgsql;

-- Add performance indexes for conflict checking
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_time ON public.attendance_sessions (session_date, start_time, end_time);

-- Migration: 20260512234419_update_attendance_conflict_validation_flexible
-- Dropping the previous version to update parameters
DROP FUNCTION IF EXISTS check_attendance_session_conflicts(UUID, UUID, DATE, TIME, TIME);

-- Updated Function to check for attendance session conflicts (Flexible for new or existing guides)
CREATE OR REPLACE FUNCTION check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
) RETURNS TEXT AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  SELECT 'O Paciente já possui atendimento neste horário na clínica ' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-002)
  SELECT 'O Profissional já possui atendimento neste horário para o paciente ' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$ LANGUAGE plpgsql;

-- Migration: 20260513005620_update_dashboard_stats_rpc
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
    'digital_validated', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL),
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

-- Migration: 20260513010801_add_cpf_to_patients
ALTER TABLE public.patients ADD COLUMN cpf TEXT UNIQUE;

-- Migration: 20260513024022_optimize_and_fix_conflict_checks
-- 1. Create missing index for professional conflict optimization
CREATE INDEX IF NOT EXISTS idx_attendances_professional_id ON public.attendances (professional_id);

-- 2. Update the conflict check function to be more explicit and robust
CREATE OR REPLACE FUNCTION public.check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME WITHOUT TIME ZONE,
  p_end TIME WITHOUT TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL AND (p_patient_id IS NULL OR p_professional_id IS NULL) THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  -- Ensure the patient doesn't have overlapping sessions
  SELECT 'O Paciente já possui atendimento neste horário na clínica ' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Important: status check can be added here if we decide to ignore some statuses
    -- but per discussion, we keep all current statuses as "occupied"
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-010)
  -- Ensure the professional is not busy with ANY other patient at this time
  SELECT 'O Profissional já está ocupado com outro paciente (' || p.name || ') neste horário.'
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$;

-- Migration: 20260513024547_include_clinic_in_conflict_message
CREATE OR REPLACE FUNCTION public.check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME WITHOUT TIME ZONE,
  p_end TIME WITHOUT TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL AND (p_patient_id IS NULL OR p_professional_id IS NULL) THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  SELECT 'O Paciente já possui atendimento neste horário na clínica ' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-010) - Now with Clinic Name
  SELECT 'O Profissional já está ocupado na clínica ' || c.name || ' com o paciente ' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$;

-- Migration: 20260514031719_add_professional_cbo_to_attendances
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS professional_cbo text;
COMMENT ON COLUMN public.attendances.professional_cbo IS 'CBO (Classificação Brasileira de Ocupações) utilized by the professional for this specific attendance.';

-- Migration: 20260514200647_restrict_professional_registration_to_admin_v2
-- Remove permissões de inserção e atualização de profissionais para usuários que não sejam SMS_ADMIN
DROP POLICY IF EXISTS "CLINIC_USER insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER update professionals" ON public.professionals;

-- Nota: A política "CLINIC_USER view own clinic professionals" é mantida para permitir 
-- que usuários de clínicas continuem selecionando profissionais em formulários de atendimento.
-- A política "SMS_ADMIN full access professionals" garante que administradores continuem com acesso total.;

-- Migration: 20260515220016_create_service_classifications
CREATE TABLE public.service_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_code text NOT NULL,
  classification_code text NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.service_classifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.service_classifications
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only" ON public.service_classifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  );

CREATE POLICY "Enable update for admin users only" ON public.service_classifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  );

CREATE POLICY "Enable delete for admin users only" ON public.service_classifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  );

-- Insert initial data
INSERT INTO public.service_classifications (service_code, classification_code, name) VALUES
('113', '001', 'Assitência Domiciliar (Serviço de Atenção Domiciliar)'),
('113', '002', 'Internação Domiciliar (Serviço de Atenção Domiciliar)'),
('135', '001', 'Reabilitação Visual (Serviço de Reabilitação)'),
('135', '002', 'Reabilitação Intelectual (Serviço de Reabilitação)'),
('135', '003', 'Reabilitação Física (Serviço de Reabilitação)'),
('113', '003', 'Equipe Multidisciplinar de Atenção Domiciliar - EMAD (Serviço de Atenção Domiciliar)'),
('113', '004', 'Equipe Multidisciplinar de Apoio - EMAP (Serviço de Atenção Domiciliar)'),
('135', '005', 'Reabiliatação Auditiva (Serviço de Reabilitação)'),
('135', '010', 'Atenção Fonoaudiológica (Serviço de Reabilitação)');

-- Migration: 20260515220858_create_cid_table
CREATE TABLE public.cid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.cid ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.cid
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only" ON public.cid
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  );

CREATE POLICY "Enable update for admin users only" ON public.cid
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN'
    )
  );

-- Insert initial data
INSERT INTO public.cid (code, name) VALUES
('F700', 'Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F701', 'Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F708', 'Retardo mental leve - outros comprometimentos do comportamento'),
('F709', 'Retardo mental leve - sem menção de comprometimento do comportamento'),
('F710', 'Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F711', 'Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F718', 'Retardo mental moderado - outros comprometimentos do comportamento'),
('F719', 'Retardo mental moderado - sem menção de comprometimento do comportamento'),
('F720', 'Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F721', 'Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F728', 'Retardo mental grave - outros comprometimentos do comportamento'),
('F729', 'Retardo mental grave - sem menção de comprometimento do comportamento'),
('F730', 'Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F731', 'Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F738', 'Retardo mental profundo - outros comprometimentos do comportamento'),
('F739', 'Retardo mental profundo - sem menção de comprometimento do comportamento'),
('F780', 'Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F781', 'Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F788', 'Outro retardo mental - outros comprometimentos do comportamento'),
('F789', 'Outro retardo mental - sem menção de comprometimento do comportamento'),
('F790', 'Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F791', 'Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F798', 'Retardo mental não especificado - outros comprometimentos do comportamento'),
('F799', 'Retardo mental não especificado - sem menção de comprometimento do comportamento'),
('F83', 'Transtornos específicos misto do desenvolvimento'),
('F840', 'Autismo infantil'),
('F841', 'Autismo atípico'),
('F842', 'Síndrome de Rett'),
('F843', 'Outro transtorno desintegrativo da infância'),
('F844', 'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados'),
('F845', 'Síndrome de asperger'),
('F848', 'Outros transtornos globais do desenvolvimento'),
('F849', 'Transtornos globais não especificados do desenvolvimento'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada');

-- Migration: 20260515221712_link_procedure_with_cid_and_service
CREATE TABLE public.procedure_service_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  service_classification_id uuid NOT NULL REFERENCES public.service_classifications(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id),
  UNIQUE (procedure_id, service_classification_id)
);

CREATE TABLE public.procedure_cid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  cid_id uuid NOT NULL REFERENCES public.cid(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (id),
  UNIQUE (procedure_id, cid_id)
);

ALTER TABLE public.procedure_service_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_cid ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for all" ON public.procedure_service_classifications FOR SELECT USING (true);
CREATE POLICY "Enable read for all" ON public.procedure_cid FOR SELECT USING (true);

CREATE POLICY "Enable all for admin" ON public.procedure_service_classifications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN')
);
CREATE POLICY "Enable all for admin" ON public.procedure_cid FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'SMS_ADMIN')
);

-- Migration: 20260515223242_add_restrictions_to_procedures
ALTER TABLE public.procedures 
ADD COLUMN max_quantity integer DEFAULT 1,
ADD COLUMN min_age integer,
ADD COLUMN max_age integer;

COMMENT ON COLUMN public.procedures.max_quantity IS 'Maximum quantity allowed for this procedure per attendance session (logic enforced at attendance entry).';
COMMENT ON COLUMN public.procedures.min_age IS 'Minimum age allowed for this procedure (in years).';
COMMENT ON COLUMN public.procedures.max_age IS 'Maximum age allowed for this procedure (in years).';

-- Migration: 20260515224831_remove_default_max_quantity
ALTER TABLE public.procedures ALTER COLUMN max_quantity DROP DEFAULT;
UPDATE public.procedures SET max_quantity = NULL WHERE max_quantity = 1; -- Reset current "1"s to NULL (unrestricted) as per user feedback;

-- Migration: 20260516001913_add_missing_cbos_to_specialties
INSERT INTO specialties (cbo, name) VALUES
('2231A1', 'Médico broncoesofalogista'),
('2231F9', 'Médico residente'),
('225103', 'Médico infectologista'),
('225105', 'Médico acupunturista'),
('225109', 'Médico nefrologista'),
('225110', 'Médico alergista e imunologista'),
('225112', 'Médico neurologista'),
('225115', 'Médico angiologista'),
('225118', 'Médico nutrologista'),
('225120', 'Médico cardiologista'),
('225121', 'Médico oncologista clínico'),
('225122', 'Médico cancerologista pediátrico'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225127', 'Médico pneumologista'),
('225130', 'Médico de família e comunidade'),
('225133', 'Médico psiquiatra'),
('225135', 'Médico dermatologista'),
('225136', 'Médico reumatologista'),
('225151', 'Médico anestesiologista'),
('225154', 'Médico Antroposófico'),
('225155', 'Médico endocrinologista e metabologista'),
('225160', 'Médico fisiatra'),
('225165', 'Médico gastroenterologista'),
('225170', 'Médico generalista'),
('225175', 'Médico geneticista'),
('225180', 'Médico geriatra'),
('225185', 'Médico hematologista'),
('225195', 'Médico homeopata'),
('225203', 'Médico em cirurgia vascular'),
('225210', 'Médico cirurgião cardiovascular'),
('225215', 'Médico cirurgião de cabeça e pescoço'),
('225220', 'Médico cirurgião do aparelho digestivo'),
('225225', 'Médico cirurgião geral'),
('225230', 'Médico cirurgião pediátrico'),
('225235', 'Médico cirurgião plástico'),
('225240', 'Médico cirurgião torácico'),
('225250', 'Médico ginecologista e obstetra'),
('225255', 'Médico mastologista'),
('225260', 'Médico neurocirurgião'),
('225265', 'Médico oftalmologista'),
('225270', 'Médico ortopedista e traumatologista'),
('225275', 'Médico otorrinolaringologista'),
('225280', 'Médico coloproctologista'),
('225285', 'Médico urologista'),
('225290', 'Médico cancerologista cirurgíco'),
('225315', 'Médico em medicina nuclear'),
('225330', 'Médico radioterapeuta'),
('225340', 'Médico hemoterapeuta'),
('225350', 'Médico neurofisiologista clínico')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002242_add_cbo_categories_to_specialties_2251_2252_2253
INSERT INTO specialties (cbo, name) VALUES
('2251', 'Médicos Clínicos'),
('2252', 'Médicos em Especialidades Cirúrgicas'),
('2253', 'Médicos em Medicina Diagnóstica e Terapêutica')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002332_add_more_cbos_to_specialties_dentists_nurses_etc
INSERT INTO specialties (cbo, name) VALUES
('223208', 'Cirurgião dentista - clínico geral'),
('223212', 'Cirurgião dentista - endodontista'),
('223220', 'Cirurgião dentista - estomatologista'),
('223224', 'Cirurgião dentista - implantodontista'),
('223228', 'Cirurgião dentista - odontogeriatra'),
('223232', 'Cirurgião dentista - odontologista legal'),
('223236', 'Cirurgião dentista - odontopediatra'),
('223240', 'Cirurgião dentista - ortopedista e ortodontista'),
('223244', 'Cirurgião dentista - patologista bucal'),
('223248', 'Cirurgião dentista - periodontista'),
('223252', 'Cirurgião dentista - protesiólogo bucomaxilofacial'),
('223256', 'Cirurgião dentista - protesista'),
('223264', 'Cirurgião dentista - reabilitador oral'),
('223268', 'Cirurgião dentista - traumatologista bucomaxilofacial'),
('223276', 'Cirurgião dentista - odontologia do trabalho'),
('223288', 'Cirurgião dentista - odontologia para pacientes com necessidades especiais'),
('223405', 'Farmacêutico'),
('223415', 'Farmacêutico analista clínico'),
('223445', 'Farmacêutico hospitalar e clínico'),
('223505', 'Enfermeiro'),
('223520', 'Enfermeiro de centro cirúrgico'),
('223525', 'Enfermeiro de terapia intensiva'),
('223530', 'Enfermeiro do trabalho'),
('223535', 'Enfermeiro nefrologista'),
('223540', 'Enfermeiro neonatologista'),
('223545', 'Enfermeiro obstétrico'),
('223550', 'Enfermeiro psiquiátrico'),
('223605', 'Fisioterapeuta geral'),
('223640', 'Fisioterapeuta osteopata'),
('223660', 'Fisioterapeuta do trabalho'),
('223710', 'Nutricionista'),
('223905', 'Terapeuta ocupacional'),
('224140', 'Profissional de educação física na saúde'),
('226305', 'Musicoterapeuta'),
('226320', 'Naturólogo'),
('239425', 'Psicopedagogo'),
('251510', 'Psicólogo clínico'),
('251520', 'Psicólogo hospitalar'),
('251535', 'Psicólogo do trânsito'),
('251540', 'Psicólogo do trabalho'),
('251545', 'Neuropsicólogo'),
('251550', 'Psicanalista'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002422_add_more_cbos_to_specialties_pedagogue_sanitarian_etc
INSERT INTO specialties (cbo, name) VALUES
('2231F9', 'Médico residente'),
('223605', 'Fisioterapeuta geral'),
('223905', 'Terapeuta ocupacional'),
('225112', 'Médico neurologista'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225130', 'Médico de família e comunidade'),
('225139', 'Médico sanitarista'),
('225142', 'Médico da estratégia de saúde da família'),
('225170', 'Médico generalista'),
('239415', 'Pedagogo'),
('251510', 'Psicólogo clínico'),
('251520', 'Psicólogo hospitalar'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002515_add_more_cbos_to_specialties_duplicate_check_4
INSERT INTO specialties (cbo, name) VALUES
('2231F9', 'Médico residente'),
('223605', 'Fisioterapeuta geral'),
('223905', 'Terapeuta ocupacional'),
('225112', 'Médico neurologista'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225142', 'Médico da estratégia de saúde da família'),
('225170', 'Médico generalista'),
('226305', 'Musicoterapeuta'),
('226320', 'Naturólogo'),
('239415', 'Pedagogo'),
('239425', 'Psicopedagogo'),
('251510', 'Psicólogo clínico'),
('251520', 'Psicólogo hospitalar'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002611_add_cbo_category_2238_fonoaudiologos
INSERT INTO specialties (cbo, name) VALUES
('2238', 'Fonoaudiólogos')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002715_add_more_cbos_to_specialties_duplicate_check_5
INSERT INTO specialties (cbo, name) VALUES
('2231F9', 'Médico residente'),
('223405', 'Farmacêutico'),
('223505', 'Enfermeiro'),
('223605', 'Fisioterapeuta geral'),
('223905', 'Terapeuta ocupacional'),
('225112', 'Médico neurologista'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225133', 'Médico psiquiatra'),
('225142', 'Médico da estratégia de saúde da família'),
('225160', 'Médico fisiatra'),
('225170', 'Médico generalista'),
('225265', 'Médico oftalmologista'),
('225270', 'Médico ortopedista e traumatologista'),
('225275', 'Médico otorrinolaringologista'),
('225350', 'Médico neurofisiologista clínico'),
('226305', 'Musicoterapeuta'),
('226320', 'Naturólogo'),
('239415', 'Pedagogo'),
('251510', 'Psicólogo clínico'),
('251520', 'Psicólogo hospitalar'),
('251545', 'Neuropsicólogo'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002754_add_more_cbos_to_specialties_duplicate_check_6
INSERT INTO specialties (cbo, name) VALUES
('2231F9', 'Médico residente'),
('223605', 'Fisioterapeuta geral'),
('223905', 'Terapeuta ocupacional'),
('226320', 'Naturólogo'),
('239415', 'Pedagogo'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002830_add_more_cbos_to_specialties_duplicate_check_7
INSERT INTO specialties (cbo, name) VALUES
('2231F9', 'Médico residente'),
('223505', 'Enfermeiro'),
('223605', 'Fisioterapeuta geral'),
('223905', 'Terapeuta ocupacional'),
('225112', 'Médico neurologista'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225142', 'Médico da estratégia de saúde da família'),
('225170', 'Médico generalista'),
('226305', 'Musicoterapeuta'),
('226320', 'Naturólogo'),
('239415', 'Pedagogo'),
('251510', 'Psicólogo clínico'),
('251605', 'Assistente social')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516002941_add_extensive_cbos_to_specialties_final_batch
INSERT INTO specialties (cbo, name) VALUES
('221205', 'Biomédico'),
('2231A1', 'Médico broncoesofalogista'),
('2231F8', 'Médico em medicina preventiva e social'),
('2231F9', 'Médico residente'),
('2231G1', 'Médico Cardiologista Intervencionista'),
('223204', 'Cirurgião dentista - auditor'),
('223208', 'Cirurgião dentista - clínico geral'),
('223212', 'Cirurgião dentista - endodontista'),
('223216', 'Cirurgião dentista - epidemiologista'),
('223220', 'Cirurgião dentista - estomatologista'),
('223224', 'Cirurgião dentista - implantodontista'),
('223228', 'Cirurgião dentista - odontogeriatra'),
('223232', 'Cirurgião dentista - odontologista legal'),
('223236', 'Cirurgião dentista - odontopediatra'),
('223240', 'Cirurgião dentista - ortopedista e ortodontista'),
('223244', 'Cirurgião dentista - patologista bucal'),
('223248', 'Cirurgião dentista - periodontista'),
('223252', 'Cirurgião dentista - protesiólogo bucomaxilofacial'),
('223256', 'Cirurgião dentista - protesista'),
('223260', 'Cirurgião dentista - radiologista'),
('223264', 'Cirurgião dentista - reabilitador oral'),
('223268', 'Cirurgião dentista - traumatologista bucomaxilofacial'),
('223272', 'Cirurgião dentista de saúde coletiva'),
('223276', 'Cirurgião dentista - odontologia do trabalho'),
('223280', 'Cirurgião dentista - dentística'),
('223284', 'Cirurgião dentista - disfunção temporomandibular e dor orofacial'),
('223288', 'Cirurgião dentista - odontologia para pacientes com necessidades especiais'),
('223293', 'Cirurgião-dentista da estratégia de saúde da família'),
('223405', 'Farmacêutico'),
('223415', 'Farmacêutico analista clínico'),
('223420', 'Farmacêutico de alimentos'),
('223425', 'Farmacêutico práticas integrativas e complementares'),
('223435', 'Farmacêutico industrial'),
('223440', 'Farmacêutico toxicologista'),
('223445', 'Farmacêutico hospitalar e clínico'),
('223505', 'Enfermeiro'),
('223510', 'Enfermeiro auditor'),
('223515', 'Enfermeiro de bordo'),
('223520', 'Enfermeiro de centro cirúrgico'),
('223525', 'Enfermeiro de terapia intensiva'),
('223530', 'Enfermeiro do trabalho'),
('223535', 'Enfermeiro nefrologista'),
('223540', 'Enfermeiro neonatologista'),
('223545', 'Enfermeiro obstétrico'),
('223550', 'Enfermeiro psiquiátrico'),
('223555', 'Enfermeiro puericultor e pediátrico'),
('223560', 'Enfermeiro sanitarista'),
('223565', 'Enfermeiro da estratégia de saúde da família'),
('223570', 'Perfusionista'),
('223580', 'Enfermeiro estomaterapeuta'),
('223605', 'Fisioterapeuta geral'),
('223625', 'Fisioterapeuta respiratória'),
('223630', 'Fisioterapeuta neurofuncional'),
('223635', 'Fisioterapeuta traumato-ortopédica funcional'),
('223640', 'Fisioterapeuta osteopata'),
('223645', 'Fisioterapeuta quiropraxista'),
('223650', 'Fisioterapeuta acupunturista'),
('223655', 'Fisioterapeuta esportivo'),
('223660', 'Fisioterapeuta do trabalho'),
('2236I1', 'Técnico em orientação e mobilidade de cegos e deficientes visuais'),
('223710', 'Nutricionista'),
('223810', 'Fonoaudiólogo geral'),
('223815', 'Fonoaudiólogo educacional'),
('223820', 'Fonoaudiólogo em audiologia'),
('223825', 'Fonoaudiólogo em disfagia'),
('223830', 'Fonoaudiólogo em linguagem'),
('223835', 'Fonoaudiólogo em motricidade orofacial'),
('223840', 'Fonoaudiólogo em saúde coletiva'),
('223845', 'Fonoaudiólogo em voz'),
('223905', 'Terapeuta ocupacional'),
('224105', 'Avaliador físico'),
('224110', 'Ludomotricista'),
('224115', 'Preparador de atleta'),
('224120', 'Preparador físico'),
('224125', 'Técnico de desporto individual e coletivo (exceto futebol)'),
('224130', 'Técnico de laboratório e fiscalização desportiva'),
('224135', 'Treinador profissional de futebol'),
('224140', 'Profissional de educação física na saúde'),
('225103', 'Médico infectologista'),
('225105', 'Médico acupunturista'),
('225106', 'Médico legista'),
('225109', 'Médico nefrologista'),
('225110', 'Médico alergista e imunologista'),
('225112', 'Médico neurologista'),
('225115', 'Médico angiologista'),
('225118', 'Médico nutrologista'),
('225120', 'Médico cardiologista'),
('225121', 'Médico oncologista clínico'),
('225122', 'Médico cancerologista pediátrico'),
('225124', 'Médico pediatra'),
('225125', 'Médico clínico'),
('225127', 'Médico pneumologista'),
('225130', 'Médico de família e comunidade'),
('225133', 'Médico psiquiatra'),
('225135', 'Médico dermatologista'),
('225136', 'Médico reumatologista'),
('225139', 'Médico sanitarista'),
('225140', 'Médico do trabalho'),
('225142', 'Médico da estratégia de saúde da família'),
('225145', 'Médico em medicina de tráfego'),
('225148', 'Médico anatomopatologista'),
('225150', 'Médico em medicina intensiva'),
('225151', 'Médico anestesiologista'),
('225154', 'Médico Antroposófico'),
('225155', 'Médico endocrinologista e metabologista'),
('225160', 'Médico fisiatra'),
('225165', 'Médico gastroenterologista'),
('225170', 'Médico generalista'),
('225175', 'Médico geneticista'),
('225180', 'Médico geriatra'),
('225185', 'Médico hematologista'),
('225195', 'Médico homeopata'),
('225203', 'Médico em cirurgia vascular'),
('225210', 'Médico cirurgião cardiovascular'),
('225215', 'Médico cirurgião de cabeça e pescoço'),
('225220', 'Médico cirurgião do aparelho digestivo'),
('225225', 'Médico cirurgião geral'),
('225230', 'Médico cirurgião pediátrico'),
('225235', 'Médico cirurgião plástico'),
('225240', 'Médico cirurgião torácico'),
('225250', 'Médico ginecologista e obstetra'),
('225255', 'Médico mastologista'),
('225260', 'Médico neurocirurgião'),
('225265', 'Médico oftalmologista'),
('225270', 'Médico ortopedista e traumatologista'),
('225275', 'Médico otorrinolaringologista'),
('225280', 'Médico coloproctologista'),
('225285', 'Médico urologista'),
('225290', 'Médico cancerologista cirurgíco'),
('225295', 'Médico cirurgião da mão'),
('225305', 'Médico citopatologista'),
('225310', 'Médico em endoscopia'),
('225315', 'Médico em medicina nuclear'),
('225325', 'Médico patologista'),
('225330', 'Médico radioterapeuta'),
('225335', 'Médico patologista clínico / medicina laboratorial'),
('225340', 'Médico hemoterapeuta'),
('225345', 'Médico hiperbarista'),
('225350', 'Médico neurofisiologista clínico'),
('226105', 'Quiropraxista'),
('226110', 'Osteopata'),
('226305', 'Musicoterapeuta'),
('226310', 'Arteterapeuta'),
('226315', 'Equoterapeuta'),
('226320', 'Naturólogo'),
('234410', 'Professor de educação física no ensino superior'),
('234415', 'Professor de enfermagem do ensino superior'),
('251505', 'Psicólogo educacional'),
('251510', 'Psicólogo clínico'),
('251515', 'Psicólogo do esporte'),
('251520', 'Psicólogo hospitalar'),
('251525', 'Psicólogo jurídico'),
('251530', 'Psicólogo social'),
('251535', 'Psicólogo do trânsito'),
('251540', 'Psicólogo do trabalho'),
('251545', 'Neuropsicólogo'),
('251550', 'Psicanalista'),
('251555', 'Psicólogo Acupunturista'),
('251605', 'Assistente social'),
('322105', 'Técnico em acupuntura'),
('322115', 'Técnico em quiropraxia'),
('322120', 'Massoterapeuta'),
('322125', 'Terapeuta holístico'),
('322205', 'Técnico de enfermagem'),
('322210', 'Técnico de enfermagem de terapia intensiva'),
('322215', 'Técnico de enfermagem do trabalho'),
('322220', 'Técnico de enfermagem psiquiátrica'),
('322225', 'Instrumentador cirúrgico'),
('322230', 'Auxiliar de enfermagem'),
('322235', 'Auxiliar de enfermagem do trabalho'),
('322240', 'Auxiliar de saúde (navegação marítima)'),
('322245', 'Técnico de enfermagem da estratégia de saúde da família'),
('322250', 'Auxiliar de enfermagem da estratégia de saúde da família'),
('322405', 'Técnico em saúde bucal'),
('322415', 'Auxiliar em saúde bucal'),
('322425', 'Técnico em saúde bucal da estratégia de saúde da família'),
('322430', 'Auxiliar em saúde bucal da estratégia de saúde da família'),
('352210', 'Agente de saúde pública'),
('515105', 'Agente comunitário de saúde'),
('515110', 'Atendente de enfermagem'),
('515115', 'Parteira leiga'),
('515120', 'Visitador sanitário'),
('515125', 'Agente indígena de saúde'),
('515130', 'Agente indígena de saneamento'),
('515135', 'Socorrista (exceto médicos e enfermeiros)'),
('515140', 'Agente de Combate às Endemias'),
('5151F1', 'Agente de Combate às Endemias'),
('516220', 'Cuidador em saúde')
ON CONFLICT (cbo) DO NOTHING;

-- Migration: 20260516003437_add_cids_to_cid_table_batch_1
INSERT INTO cid (code, name) VALUES
('F700', 'Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F708', 'Retardo mental leve - outros comprometimentos do comportamento'),
('F709', 'Retardo mental leve - sem menção de comprometimento do comportamento'),
('F710', 'Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F711', 'Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F718', 'Retardo mental moderado - outros comprometimentos do comportamento'),
('F719', 'Retardo mental moderado - sem menção de comprometimento do comportamento'),
('F720', 'Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F721', 'Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F728', 'Retardo mental grave - outros comprometimentos do comportamento'),
('F729', 'Retardo mental grave - sem menção de comprometimento do comportamento'),
('F730', 'Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F731', 'Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F738', 'Retardo mental profundo - outros comprometimentos do comportamento'),
('F739', 'Retardo mental profundo - sem menção de comprometimento do comportamento'),
('F780', 'Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F781', 'Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F788', 'Outro retardo mental - outros comprometimentos do comportamento'),
('F789', 'Outro retardo mental - sem menção de comprometimento do comportamento'),
('F790', 'Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F791', 'Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F798', 'Retardo mental não especificado - outros comprometimentos do comportamento'),
('F799', 'Retardo mental não especificado - sem menção de comprometimento do comportamento'),
('F83', 'Transtornos específicos misto do desenvolvimento'),
('F840', 'Autismo infantil'),
('F841', 'Autismo atípico'),
('F842', 'Síndrome de Rett'),
('F843', 'Outro transtorno desintegrativo da infância'),
('F844', 'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados'),
('F845', 'Síndrome de asperger'),
('F848', 'Outros transtornos globais do desenvolvimento'),
('F849', 'Transtornos globais não especificados do desenvolvimento'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada')
ON CONFLICT (code) DO NOTHING;

-- Migration: 20260516003509_add_cids_to_cid_table_batch_2_including_f819
INSERT INTO cid (code, name) VALUES
('F700', 'Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F708', 'Retardo mental leve - outros comprometimentos do comportamento'),
('F709', 'Retardo mental leve - sem menção de comprometimento do comportamento'),
('F710', 'Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F711', 'Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F718', 'Retardo mental moderado - outros comprometimentos do comportamento'),
('F719', 'Retardo mental moderado - sem menção de comprometimento do comportamento'),
('F720', 'Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F721', 'Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F728', 'Retardo mental grave - outros comprometimentos do comportamento'),
('F729', 'Retardo mental grave - sem menção de comprometimento do comportamento'),
('F730', 'Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F731', 'Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F738', 'Retardo mental profundo - outros comprometimentos do comportamento'),
('F739', 'Retardo mental profundo - sem menção de comprometimento do comportamento'),
('F780', 'Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F781', 'Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F788', 'Outro retardo mental - outros comprometimentos do comportamento'),
('F789', 'Outro retardo mental - sem menção de comprometimento do comportamento'),
('F790', 'Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F791', 'Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F798', 'Retardo mental não especificado - outros comprometimentos do comportamento'),
('F799', 'Retardo mental não especificado - sem menção de comprometimento do comportamento'),
('F819', 'Transtorno não especificado do desenvolvimento das habilidades escolares'),
('F83', 'Transtornos específicos misto do desenvolvimento'),
('F840', 'Autismo infantil'),
('F841', 'Autismo atípico'),
('F842', 'Síndrome de Rett'),
('F843', 'Outro transtorno desintegrativo da infância'),
('F844', 'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados'),
('F845', 'Síndrome de asperger'),
('F848', 'Outros transtornos globais do desenvolvimento'),
('F849', 'Transtornos globais não especificados do desenvolvimento'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada')
ON CONFLICT (code) DO NOTHING;

-- Migration: 20260516003537_add_cids_to_cid_table_batch_3_hearing_voice_etc
INSERT INTO cid (code, name) VALUES
('F900', 'Distúrbios da atividade e da atenção'),
('F985', 'Gagueira [tartamudez]'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada'),
('H833', 'Efeitos do ruído sobre o ouvido interno'),
('H900', 'Perda de audição bilateral devida a transtorno de condução'),
('H901', 'Perda de audição unilateral por transtorno de condução, sem restrição de audição contralateral'),
('H902', 'Perda não especificada de audição devida a transtorno de condução'),
('H903', 'Perda de audição bilateral neuro-sensorial'),
('H904', 'Perda de audição unilateral neuro-sensorial, sem restrição de audição contralateral'),
('H905', 'Perda de audição neuro-sensorial não especificada'),
('H906', 'Perda de audição bilateral mista, de condução e neuro-sensorial'),
('H907', 'Perda de audição unilateral mista, de condução e neuro-sensorial, sem restrição de audição contralateral'),
('H908', 'Perda de audição mista, de condução e neuro-sensorial, não especificada'),
('H910', 'Perda de audição ototóxica'),
('H911', 'Presbiacusia'),
('H912', 'Perda de audição súbita idiopática'),
('H913', 'Surdo-mudez não classificada em outra parte'),
('H918', 'Outras perdas de audição especificadas'),
('H919', 'Perda não especificada de audição'),
('H932', 'Outras percepções auditivas anormais'),
('R49', 'Distúrbios da voz'),
('R490', 'Disfonia'),
('R491', 'Afonia'),
('R498', 'Outros distúrbios da voz e os não especificados')
ON CONFLICT (code) DO NOTHING;

-- Migration: 20260516003631_add_cids_to_cid_table_batch_4_learning_motor_etc
INSERT INTO cid (code, name) VALUES
('F701', 'Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F700', 'Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F708', 'Retardo mental leve - outros comprometimentos do comportamento'),
('F709', 'Retardo mental leve - sem menção de comprometimento do comportamento'),
('F710', 'Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F711', 'Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F718', 'Retardo mental moderado - outros comprometimentos do comportamento'),
('F719', 'Retardo mental moderado - sem menção de comprometimento do comportamento'),
('F720', 'Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F721', 'Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F728', 'Retardo mental grave - outros comprometimentos do comportamento'),
('F729', 'Retardo mental grave - sem menção de comprometimento do comportamento'),
('F730', 'Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F731', 'Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F738', 'Retardo mental profundo - outros comprometimentos do comportamento'),
('F739', 'Retardo mental profundo - sem menção de comprometimento do comportamento'),
('F780', 'Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F781', 'Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F788', 'Outro retardo mental - outros comprometimentos do comportamento'),
('F789', 'Outro retardo mental - sem menção de comprometimento do comportamento'),
('F790', 'Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F791', 'Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F798', 'Retardo mental não especificado - outros comprometimentos do comportamento'),
('F799', 'Retardo mental não especificado - sem menção de comprometimento do comportamento'),
('F810', 'Transtorno específico de leitura'),
('F82', 'Transtorno específico do desenvolvimento motor'),
('F83', 'Transtornos específicos misto do desenvolvimento'),
('F840', 'Autismo infantil'),
('F841', 'Autismo atípico'),
('F842', 'Síndrome de Rett'),
('F843', 'Outro transtorno desintegrativo da infância'),
('F844', 'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados'),
('F845', 'Síndrome de asperger'),
('F848', 'Outros transtornos globais do desenvolvimento'),
('F849', 'Transtornos globais não especificados do desenvolvimento'),
('F88', 'Outros transtornos do desenvolvimento psicológico'),
('F89', 'Transtorno do desenvolvimento psicológico não especificado'),
('F900', 'Distúrbios da atividade e da atenção'),
('F910', 'Distúrbio de conduta restrito ao contexto familiar'),
('F920', 'Distúrbio depressivo de conduta'),
('F930', 'Transtorno ligado à angústia de separação'),
('F940', 'Mutismo eletivo'),
('F980', 'Enurese de origem não-orgânica'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada'),
('H540', 'Cegueira, ambos os olhos'),
('H900', 'Perda de audição bilateral devida a transtorno de condução'),
('H910', 'Perda de audição ototóxica')
ON CONFLICT (code) DO NOTHING;

-- Migration: 20260516003709_add_cids_to_cid_table_duplicate_check_final_batch
INSERT INTO cid (code, name) VALUES
('F700', 'Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F701', 'Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F708', 'Retardo mental leve - outros comprometimentos do comportamento'),
('F709', 'Retardo mental leve - sem menção de comprometimento do comportamento'),
('F710', 'Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F711', 'Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F718', 'Retardo mental moderado - outros comprometimentos do comportamento'),
('F719', 'Retardo mental moderado - sem menção de comprometimento do comportamento'),
('F720', 'Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F721', 'Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F728', 'Retardo mental grave - outros comprometimentos do comportamento'),
('F729', 'Retardo mental grave - sem menção de comprometimento do comportamento'),
('F730', 'Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F731', 'Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F738', 'Retardo mental profundo - outros comprometimentos do comportamento'),
('F739', 'Retardo mental profundo - sem menção de comprometimento do comportamento'),
('F780', 'Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F781', 'Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F788', 'Outro retardo mental - outros comprometimentos do comportamento'),
('F789', 'Outro retardo mental - sem menção de comprometimento do comportamento'),
('F790', 'Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento'),
('F791', 'Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento'),
('F798', 'Retardo mental não especificado - outros comprometimentos do comportamento'),
('F799', 'Retardo mental não especificado - sem menção de comprometimento do comportamento'),
('F83', 'Transtornos específicos misto do desenvolvimento'),
('F840', 'Autismo infantil'),
('F841', 'Autismo atípico'),
('F842', 'Síndrome de Rett'),
('F843', 'Outro transtorno desintegrativo da infância'),
('F844', 'Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados'),
('F845', 'Síndrome de asperger'),
('F848', 'Outros transtornos globais do desenvolvimento'),
('F849', 'Transtornos globais não especificados do desenvolvimento'),
('G800', 'Paralisia cerebral quadriplágica espástica'),
('G801', 'Paralisia cerebral diplégica espástica'),
('G802', 'Paralisia cerebral hemiplégica espástica'),
('G803', 'Paralisia cerebral discinética'),
('G804', 'Paralisia cerebral atáxica'),
('G808', 'Outras formas de paralisia cerebral'),
('G809', 'Paralisia cerebral não especificada')
ON CONFLICT (code) DO NOTHING;

-- Migration: 20260516003918_add_missing_service_classifications_datasus
INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '115', '002', 'Atendimento psicossocial (Serviço de Atenção Psicossocial)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '115' AND classification_code = '002');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '011', 'Atenção Fisioterapeutica (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '011');

-- Migration: 20260516004014_add_more_service_classifications_duplicate_check_2
INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '113', '001', 'Assitência Domiciliar (Serviço de Atenção Domiciliar)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '113' AND classification_code = '001');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '113', '002', 'Internação Domiciliar (Serviço de Atenção Domiciliar)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '113' AND classification_code = '002');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '001', 'Reabilitação Visual (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '001');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '002', 'Reabilitação Intelectual (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '002');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '003', 'Reabilitação Física (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '003');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '113', '003', 'Equipe Multidisciplinar de Atenção Domiciliar - EMAD (Serviço de Atenção Domiciliar)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '113' AND classification_code = '003');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '005', 'Reabiliatação Auditiva (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '005');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '010', 'Atenção Fonoaudiológica (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '010');

-- Migration: 20260516004129_add_service_classifications_135_007_135_008_orthopedic_workshop
INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '007', 'Oficina Ortopédica Fixa (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '007');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT '135', '008', 'Oficina Ortopédica Intinerante (Serviço de Reabilitação)'
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = '135' AND classification_code = '008');

-- Migration: 20260516013502_normalize_document_columns
-- Limpeza de Profissionais
UPDATE public.professionals 
SET 
  cpf = regexp_replace(cpf, '[^0-9]', '', 'g'),
  cns = regexp_replace(cns, '[^0-9]', '', 'g')
WHERE cpf IS NOT NULL OR cns IS NOT NULL;

-- Limpeza de Pacientes
UPDATE public.patients 
SET 
  cpf = regexp_replace(cpf, '[^0-9]', '', 'g'),
  cns_patient = regexp_replace(cns_patient, '[^0-9]', '', 'g')
WHERE cpf IS NOT NULL OR cns_patient IS NOT NULL;

-- Limpeza de Clínicas
UPDATE public.clinics 
SET 
  cnpj = regexp_replace(cnpj, '[^0-9]', '', 'g')
WHERE cnpj IS NOT NULL;

-- Limpeza de Procedimentos
UPDATE public.procedures 
SET 
  code = regexp_replace(code, '[^0-9]', '', 'g')
WHERE code IS NOT NULL;

-- Limpeza de CID (Mantém letras e números, remove pontos)
UPDATE public.cid 
SET 
  code = regexp_replace(code, '[^a-zA-Z0-9]', '', 'g')
WHERE code IS NOT NULL;

-- Limpeza de Classificações DATASUS
UPDATE public.service_classifications 
SET 
  service_code = regexp_replace(service_code, '[^0-9]', '', 'g'),
  classification_code = regexp_replace(classification_code, '[^0-9]', '', 'g')
WHERE service_code IS NOT NULL OR classification_code IS NOT NULL;

-- Migration: 20260516031238_add_nao_realizado_status_to_sessions
ALTER TABLE attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;

ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check 
CHECK (status = ANY (ARRAY['Realizada'::text, 'Pendente'::text, 'Glosado'::text, 'Não Realizado'::text]));

-- Migration: 20260516033824_add_service_classification_to_attendances
ALTER TABLE attendances 
ADD COLUMN service_classification_id UUID REFERENCES service_classifications(id);

COMMENT ON COLUMN attendances.service_classification_id IS 'Referência à classificação DataSUS (Serviço/Classificação)';

-- Migration: 20260516125058_create_historical_audit_tables
-- 1. Adicionar flag de importação histórica na tabela real de atendimentos
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS is_historical_import BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.attendances.is_historical_import IS 'Marca se o registro foi importado via módulo de auditoria histórica (dados legados Excel).';

-- 2. Criar tabela de lotes de importação
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  rows_resolved INTEGER DEFAULT 0,
  rows_unmatched INTEGER DEFAULT 0,
  rows_approved INTEGER DEFAULT 0,
  rows_glossed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'mapping', 'matching', 'validating', 'completed', 'cancelled')),
  imported_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Criar tabela de registros históricos (Staging)
CREATE TABLE IF NOT EXISTS public.import_historical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,            -- Linha original na planilha
  
  -- Dados brutos da planilha
  raw_patient_name TEXT,
  raw_patient_cns TEXT,
  raw_professional_name TEXT,
  raw_professional_cns TEXT,
  raw_clinic_name TEXT,
  raw_session_date TEXT, -- Mantido como TEXT para aceitar diversos formatos de data do Excel antes do parsing
  raw_start_time TEXT,
  raw_end_time TEXT,
  raw_procedure_code TEXT,
  raw_procedure_name TEXT,
  raw_cid TEXT,
  raw_auth_number TEXT,
  
  -- IDs resolvidos (NULL se não encontrado)
  resolved_patient_id UUID REFERENCES public.patients(id),
  resolved_professional_id UUID REFERENCES public.professionals(id),
  resolved_clinic_id UUID REFERENCES public.clinics(id),
  resolved_procedure_id UUID REFERENCES public.procedures(id),
  
  -- Status do matching
  match_status TEXT DEFAULT 'pending'
    CHECK (match_status IN ('resolved', 'partial', 'unmatched', 'pending')),
  match_notes TEXT,                       -- Detalhes do que não bateu
  
  -- Status da validação de regras
  validation_status TEXT DEFAULT 'not_validated'
    CHECK (validation_status IN ('not_validated', 'approved', 'glossed')),
  validation_rules_violated TEXT[],       -- Array: ['BR-001', 'BR-010', ...]
  validation_details JSONB,              -- Detalhes: conflito com quem, onde, etc.
  
  -- Status de persistência
  persisted BOOLEAN DEFAULT FALSE,       -- TRUE quando gravado nas tabelas reais
  persisted_attendance_id UUID,
  persisted_session_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar RLS e criar políticas (Apenas SMS_ADMIN)
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_historical_records ENABLE ROW LEVEL SECURITY;

-- Política para import_batches
CREATE POLICY "SMS_ADMIN can do everything on import_batches"
  ON public.import_batches
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SMS_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SMS_ADMIN'));

-- Política para import_historical_records
CREATE POLICY "SMS_ADMIN can do everything on import_historical_records"
  ON public.import_historical_records
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SMS_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'SMS_ADMIN'));

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_import_historical_records_batch_id ON public.import_historical_records(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_historical_records_match_status ON public.import_historical_records(match_status);
CREATE INDEX IF NOT EXISTS idx_import_historical_records_validation_status ON public.import_historical_records(validation_status);

-- Migration: 20260516125403_rpc_match_historical_records
CREATE OR REPLACE FUNCTION match_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_matched_patients INTEGER := 0;
    v_matched_professionals INTEGER := 0;
    v_matched_clinics INTEGER := 0;
    v_matched_procedures INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- 1. Matching de Pacientes (Exato por CNS)
    UPDATE import_historical_records i
    SET patient_id = p.id,
        match_status = CASE 
            WHEN i.professional_id IS NOT NULL AND i.clinic_id IS NOT NULL AND i.procedure_id IS NOT NULL THEN 'resolved'::import_match_status
            ELSE i.match_status 
        END
    FROM patients p
    WHERE i.import_batch_id = p_batch_id
      AND i.patient_id IS NULL
      AND i.raw_patient_cns = p.cns;
    
    GET DIAGNOSTICS v_matched_patients = ROW_COUNT;

    -- 2. Matching de Profissionais (Exato por CNS ou CPF)
    UPDATE import_historical_records i
    SET professional_id = p.id
    FROM professionals p
    WHERE i.import_batch_id = p_batch_id
      AND i.professional_id IS NULL
      AND (i.raw_professional_cns = p.cns OR i.raw_professional_cns = p.cpf);
    
    GET DIAGNOSTICS v_matched_professionals = ROW_COUNT;

    -- 3. Matching de Clínicas (Exato por Nome)
    UPDATE import_historical_records i
    SET clinic_id = c.id
    FROM clinics c
    WHERE i.import_batch_id = p_batch_id
      AND i.clinic_id IS NULL
      AND UPPER(i.raw_clinic_name) = UPPER(c.name);
    
    GET DIAGNOSTICS v_matched_clinics = ROW_COUNT;

    -- 4. Matching de Procedimentos (Exato por Código)
    UPDATE import_historical_records i
    SET procedure_id = pr.id
    FROM procedures pr
    WHERE i.import_batch_id = p_batch_id
      AND i.procedure_id IS NULL
      AND i.raw_procedure_code = pr.code;
    
    GET DIAGNOSTICS v_matched_procedures = ROW_COUNT;

    -- Atualizar status global do registro se tudo estiver ok
    UPDATE import_historical_records
    SET match_status = 'resolved'
    WHERE import_batch_id = p_batch_id
      AND patient_id IS NOT NULL
      AND professional_id IS NOT NULL
      AND clinic_id IS NOT NULL
      AND procedure_id IS NOT NULL;

    SELECT count(*) INTO v_total FROM import_historical_records WHERE import_batch_id = p_batch_id;

    RETURN jsonb_build_object(
        'patients', v_matched_patients,
        'professionals', v_matched_professionals,
        'clinics', v_matched_clinics,
        'procedures', v_matched_procedures,
        'total', v_total
    );
END;
$$;

-- Migration: 20260516125455_rpc_validate_historical_records
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_errors JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
    LOOP
        v_errors := '[]'::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.patient_id AND status != 'Ativo') THEN
            v_errors := v_errors || jsonb_build_object('code', 'BR-001', 'message', 'Paciente não está ativo no sistema');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.professional_id AND status != 'Ativo') THEN
            v_errors := v_errors || jsonb_build_object('code', 'BR-002', 'message', 'Profissional não está ativo no sistema');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.clinic_id AND status != 'Ativo') THEN
            v_errors := v_errors || jsonb_build_object('code', 'BR-003', 'message', 'Clínica não está ativa no sistema');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010) - Sessões Reais
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.patient_id, 
            v_record.professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_errors := v_errors || jsonb_build_object('code', 'BR-010', 'message', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.professional_id = v_record.professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_errors := v_errors || jsonb_build_object('code', 'BR-010-INT', 'message', 'Conflito de horário detectado dentro desta planilha para o mesmo profissional');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_errors = v_errors,
            match_status = CASE WHEN jsonb_array_length(v_errors) > 0 THEN 'pending'::import_match_status ELSE 'resolved'::import_match_status END
        WHERE id = v_record.id;

        IF jsonb_array_length(v_errors) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    -- Atualizar status do batch
    UPDATE import_batches
    SET status = 'validating'
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'validated', v_validated_count,
        'errors', v_error_count
    );
END;
$$;

-- Migration: 20260516125701_fix_historical_audit_rpcs_and_finalize
-- 1. Recriar RPC de Matching com nomes de colunas corretos
CREATE OR REPLACE FUNCTION match_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_matched_patients INTEGER := 0;
    v_matched_professionals INTEGER := 0;
    v_matched_clinics INTEGER := 0;
    v_matched_procedures INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- 1. Matching de Pacientes (Exato por CNS)
    UPDATE import_historical_records i
    SET resolved_patient_id = p.id
    FROM patients p
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_patient_id IS NULL
      AND i.raw_patient_cns = p.cns_patient;
    
    GET DIAGNOSTICS v_matched_patients = ROW_COUNT;

    -- 2. Matching de Profissionais (Exato por CNS ou CPF)
    UPDATE import_historical_records i
    SET resolved_professional_id = p.id
    FROM professionals p
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_professional_id IS NULL
      AND (i.raw_professional_cns = p.cns OR i.raw_professional_cns = p.cpf);
    
    GET DIAGNOSTICS v_matched_professionals = ROW_COUNT;

    -- 3. Matching de Clínicas (Exato por Nome)
    UPDATE import_historical_records i
    SET resolved_clinic_id = c.id
    FROM clinics c
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_clinic_id IS NULL
      AND UPPER(TRIM(i.raw_clinic_name)) = UPPER(TRIM(c.name));
    
    GET DIAGNOSTICS v_matched_clinics = ROW_COUNT;

    -- 4. Matching de Procedimentos (Exato por Código)
    UPDATE import_historical_records i
    SET resolved_procedure_id = pr.id
    FROM procedures pr
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_procedure_id IS NULL
      AND i.raw_procedure_code = pr.code;
    
    GET DIAGNOSTICS v_matched_procedures = ROW_COUNT;

    -- Atualizar status global do registro se tudo estiver ok
    UPDATE import_historical_records
    SET match_status = 'resolved'
    WHERE import_batch_id = p_batch_id
      AND resolved_patient_id IS NOT NULL
      AND resolved_professional_id IS NOT NULL
      AND resolved_clinic_id IS NOT NULL
      AND resolved_procedure_id IS NOT NULL;

    SELECT count(*) INTO v_total FROM import_historical_records WHERE import_batch_id = p_batch_id;

    RETURN jsonb_build_object(
        'patients', v_matched_patients,
        'professionals', v_matched_professionals,
        'clinics', v_matched_clinics,
        'procedures', v_matched_procedures,
        'total', v_total
    );
END;
$$;

-- 2. Recriar RPC de Validação com nomes de colunas corretos
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := '[]'::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-001');
            v_details := v_details || jsonb_build_object('code', 'BR-001', 'message', 'Paciente não está ativo no sistema');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-002');
            v_details := v_details || jsonb_build_object('code', 'BR-002', 'message', 'Profissional não está ativo no sistema');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-003');
            v_details := v_details || jsonb_build_object('code', 'BR-003', 'message', 'Clínica não está ativa no sistema');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010) - Sessões Reais
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010');
            v_details := v_details || jsonb_build_object('code', 'BR-010', 'message', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010-INT');
            v_details := v_details || jsonb_build_object('code', 'BR-010-INT', 'message', 'Conflito de horário detectado dentro desta planilha para o mesmo profissional');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN 'glossed'::import_validation_status ELSE 'approved'::import_validation_status END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'validated', v_validated_count,
        'errors', v_error_count
    );
END;
$$;

-- 3. Criar RPC de Finalização
CREATE OR REPLACE FUNCTION finalize_historical_import(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_attendance_id UUID;
    v_imported_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
          AND validation_status = 'approved'
          AND persisted = FALSE
    LOOP
        -- Inserir Header de Attendance
        INSERT INTO public.attendances (
            clinic_id,
            professional_id,
            patient_id,
            procedure_id,
            attendance_date,
            start_time,
            end_time,
            cid,
            auth_number,
            status,
            is_historical_import,
            month_year
        ) VALUES (
            v_record.resolved_clinic_id,
            v_record.resolved_professional_id,
            v_record.resolved_patient_id,
            v_record.resolved_procedure_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            v_record.raw_cid,
            v_record.raw_auth_number,
            'Realizada',
            TRUE,
            to_char(v_record.raw_session_date::DATE, 'MM/YYYY')
        ) RETURNING id INTO v_attendance_id;

        -- Inserir Sessão de Attendance
        INSERT INTO public.attendance_sessions (
            attendance_id,
            session_date,
            start_time,
            end_time,
            status,
            validated_at
        ) VALUES (
            v_attendance_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            'Realizada',
            NOW()
        );

        -- Marcar como persistido
        UPDATE import_historical_records
        SET persisted = TRUE,
            persisted_attendance_id = v_attendance_id
        WHERE id = v_record.id;

        v_imported_count := v_imported_count + 1;
    END LOOP;

    -- Finalizar o Batch
    UPDATE import_batches
    SET status = 'completed',
        completed_at = NOW(),
        rows_approved = v_imported_count
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'imported', v_imported_count
    );
END;
$$;

-- Migration: 20260516125816_fix_sql_casts_in_historical_audit
-- Corrigindo os casts para usar TEXT já que as colunas são TEXT com CHECK constraints
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := '[]'::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-001');
            v_details := v_details || jsonb_build_object('code', 'BR-001', 'message', 'Paciente não está ativo no sistema');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-002');
            v_details := v_details || jsonb_build_object('code', 'BR-002', 'message', 'Profissional não está ativo no sistema');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-003');
            v_details := v_details || jsonb_build_object('code', 'BR-003', 'message', 'Clínica não está ativa no sistema');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010');
            v_details := v_details || jsonb_build_object('code', 'BR-010', 'message', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010-INT');
            v_details := v_details || jsonb_build_object('code', 'BR-010-INT', 'message', 'Conflito de horário detectado dentro desta planilha para o mesmo profissional');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN 'glossed' ELSE 'approved' END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'validated', v_validated_count,
        'errors', v_error_count
    );
END;
$$;

-- Migration: 20260516125834_fix_check_attendance_conflict_call_historical_audit
-- Corrigindo a chamada da função check_attendance_session_conflicts (faltava um argumento NULL para p_attendance_id)
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := '[]'::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-001');
            v_details := v_details || jsonb_build_object('code', 'BR-001', 'message', 'Paciente não está ativo no sistema');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-002');
            v_details := v_details || jsonb_build_object('code', 'BR-002', 'message', 'Profissional não está ativo no sistema');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-003');
            v_details := v_details || jsonb_build_object('code', 'BR-003', 'message', 'Clínica não está ativa no sistema');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        -- Argumentos: p_session_id, p_attendance_id, p_patient_id, p_professional_id, p_date, p_start, p_end
        v_conflict_msg := public.check_attendance_session_conflicts(
            NULL, 
            NULL,
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010');
            v_details := v_details || jsonb_build_object('code', 'BR-010', 'message', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010-INT');
            v_details := v_details || jsonb_build_object('code', 'BR-010-INT', 'message', 'Conflito de horário detectado dentro desta planilha para o mesmo profissional');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN 'glossed' ELSE 'approved' END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'validated', v_validated_count,
        'errors', v_error_count
    );
END;
$$;

-- Migration: 20260516133549_add_clinical_fields_to_historical_records
ALTER TABLE public.import_historical_records 
ADD COLUMN cid text,
ADD COLUMN service_classification_id uuid REFERENCES public.service_classifications(id),
ADD COLUMN attendance_character text DEFAULT '01';

COMMENT ON COLUMN public.import_historical_records.cid IS 'Resolved CID for historical import';
COMMENT ON COLUMN public.import_historical_records.service_classification_id IS 'Resolved DataSUS service classification';
COMMENT ON COLUMN public.import_historical_records.attendance_character IS 'Resolved attendance character (01=Eletivo, etc)';

-- Migration: 20260516133604_add_resolved_metadata_to_historical_records_v2
ALTER TABLE public.import_historical_records 
ADD COLUMN resolved_session_date date,
ADD COLUMN resolved_start_time time without time zone,
ADD COLUMN resolved_end_time time without time zone,
ADD COLUMN resolved_auth_number text,
ADD COLUMN resolved_quantity integer DEFAULT 1;

COMMENT ON COLUMN public.import_historical_records.resolved_session_date IS 'Manually corrected session date';
COMMENT ON COLUMN public.import_historical_records.resolved_quantity IS 'Manually corrected quantity for BPA';

-- Migration: 20260516140143_reporting_module_functions
-- 1. Relatório Detalhado de Faturamento (BPA Ready)
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.co_procedimento as procedure_code,
      proc.no_procedimento as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Relatório de Desempenho e Produtividade
CREATE OR REPLACE FUNCTION get_performance_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      prof.name as professional_name,
      COUNT(s.id) FILTER (WHERE s.status = 'Realizada') as completed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Não Realizado') as missed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Pendente') as pending_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Glosado') as denied_sessions,
      SUM(proc.valor_total) FILTER (WHERE s.status = 'Realizada') as total_value,
      ROUND((COUNT(s.id) FILTER (WHERE s.status = 'Não Realizado')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100), 2) as absenteeism_rate
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, prof.name
    ORDER BY total_value DESC NULLS LAST
  ) stats;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Relatório de Inconsistências (Audit)
CREATE OR REPLACE FUNCTION get_consistency_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(issues) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      prof.name as professional_name,
      proc.no_procedimento as procedure_name,
      s.session_date,
      CASE 
        WHEN a.professional_cbo IS NULL OR a.professional_cbo = '' THEN 'CBO Ausente'
        WHEN p.cns IS NULL OR p.cns = '' THEN 'CNS do Paciente Ausente'
        WHEN prof.cns IS NULL OR prof.cns = '' THEN 'CNS do Profissional Ausente'
        WHEN a.cid IS NULL OR a.cid = '' THEN 'CID Ausente'
        WHEN s.status = 'Realizada' AND (s.validated_at IS NULL) THEN 'Sessão Realizada sem Assinatura Digital'
        ELSE 'Inconsistência de Metadados'
      END as issue_type
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (
        a.professional_cbo IS NULL OR a.professional_cbo = '' OR
        p.cns IS NULL OR p.cns = '' OR
        prof.cns IS NULL OR prof.cns = '' OR
        a.cid IS NULL OR a.cid = '' OR
        (s.status = 'Realizada' AND s.validated_at IS NULL)
      )
    ORDER BY s.session_date DESC
  ) issues;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260516142929_reporting_mode_support
-- 1. Atualização do Relatório de Faturamento para suportar Modos
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'official'
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.co_procedimento as procedure_code,
      proc.no_procedimento as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE -- 'all' mode
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260516144752_reporting_filters_fix
-- Atualização da função de faturamento para incluir filtro de procedimento e tratamento de nulos
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_procedure_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'official'
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260516145211_reporting_pagination
-- Atualização da função de faturamento com paginação
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_procedure_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'official',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
    AND (
      CASE 
        WHEN p_mode = 'official' THEN s.status = 'Realizada'
        WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
        ELSE TRUE 
      END
    );

  -- Busca dos dados com limite/offset
  SELECT json_agg(rows) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
    LIMIT p_limit
    OFFSET p_offset
  ) rows;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260516145234_reporting_pagination_all
-- Atualização da função de performance com paginação
CREATE OR REPLACE FUNCTION get_performance_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Total de grupos (linhas no relatório)
  SELECT count(*) INTO v_total
  FROM (
    SELECT c.id, prof.id
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.id, prof.id
  ) groups;

  SELECT json_agg(stats) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      prof.name as professional_name,
      COUNT(s.id) FILTER (WHERE s.status = 'Realizada') as completed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Não Realizado') as missed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Pendente') as pending_sessions,
      COUNT(s.id) FILTER (WHERE s.status = 'Glosado') as denied_sessions,
      SUM(proc.valor_total) FILTER (WHERE s.status = 'Realizada') as total_value,
      ROUND((COUNT(s.id) FILTER (WHERE s.status = 'Não Realizado')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100), 2) as absenteeism_rate
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, prof.name
    ORDER BY total_value DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  ) stats;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualização da função de consistência com paginação
CREATE OR REPLACE FUNCTION get_consistency_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  JOIN patients p ON a.patient_id = p.id
  JOIN professionals prof ON a.professional_id = prof.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (
      a.professional_cbo IS NULL OR a.professional_cbo = '' OR
      p.cns_patient IS NULL OR p.cns_patient = '' OR
      prof.cns IS NULL OR prof.cns = '' OR
      a.cid IS NULL OR a.cid = '' OR
      (s.status = 'Realizada' AND s.validated_at IS NULL)
    );

  SELECT json_agg(issues) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      prof.name as professional_name,
      proc.name as procedure_name,
      s.session_date,
      CASE 
        WHEN a.professional_cbo IS NULL OR a.professional_cbo = '' THEN 'CBO Ausente'
        WHEN p.cns_patient IS NULL OR p.cns_patient = '' THEN 'CNS do Paciente Ausente'
        WHEN prof.cns IS NULL OR prof.cns = '' THEN 'CNS do Profissional Ausente'
        WHEN a.cid IS NULL OR a.cid = '' THEN 'CID Ausente'
        WHEN s.status = 'Realizada' AND (s.validated_at IS NULL) THEN 'Sessão Realizada sem Assinatura Digital'
        ELSE 'Inconsistência de Metadados'
      END as issue_type
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (
        a.professional_cbo IS NULL OR a.professional_cbo = '' OR
        p.cns_patient IS NULL OR p.cns_patient = '' OR
        prof.cns IS NULL OR prof.cns = '' OR
        a.cid IS NULL OR a.cid = '' OR
        (s.status = 'Realizada' AND s.validated_at IS NULL)
      )
    ORDER BY s.session_date DESC
    LIMIT p_limit
    OFFSET p_offset
  ) issues;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260516152325_create_report_requests_table_v2
-- Create report_requests table for secure printing
CREATE TABLE IF NOT EXISTS public.report_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filters JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.report_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own report requests
CREATE POLICY "Users can only read their own report requests"
    ON public.report_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own report requests
CREATE POLICY "Users can only insert their own report requests"
    ON public.report_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Add index on expires_at for cleanup
CREATE INDEX idx_report_requests_expires_at ON public.report_requests(expires_at);

-- Migration: 20260516223216_add_audit_fields_to_attendance_sessions
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS action_by_login text;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS validation_type text;

-- Migration: 20260517143140_add_active_to_professional_clinics
ALTER TABLE public.professional_clinics ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Migration: 20260517155057_add_target_competence_to_historical_import
-- Migration para suporte a competências retroativas na importação histórica
ALTER TABLE public.import_batches 
ADD COLUMN IF NOT EXISTS target_competence VARCHAR(7);

CREATE OR REPLACE FUNCTION public.finalize_historical_import(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_record RECORD;
    v_attendance_id UUID;
    v_imported_count INTEGER := 0;
    v_target_competence VARCHAR(7);
BEGIN
    -- Busca a competência definida no lote
    SELECT target_competence INTO v_target_competence 
    FROM import_batches 
    WHERE id = p_batch_id;

    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
          AND validation_status = 'approved'
          AND persisted = FALSE
    LOOP
        -- Inserir Header de Attendance
        INSERT INTO public.attendances (
            clinic_id,
            professional_id,
            patient_id,
            procedure_id,
            attendance_date,
            start_time,
            end_time,
            cid,
            auth_number,
            status,
            is_historical_import,
            month_year
        ) VALUES (
            v_record.resolved_clinic_id,
            v_record.resolved_professional_id,
            v_record.resolved_patient_id,
            v_record.resolved_procedure_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            v_record.raw_cid,
            v_record.raw_auth_number,
            'Realizada',
            TRUE,
            -- Se o lote tiver competência definida, usa ela. Caso contrário, gera da data do atendimento.
            COALESCE(v_target_competence, to_char(v_record.raw_session_date::DATE, 'MM/YYYY'))
        ) RETURNING id INTO v_attendance_id;

        -- Inserir Sessão de Attendance
        INSERT INTO public.attendance_sessions (
            attendance_id,
            session_date,
            start_time,
            end_time,
            status,
            validated_at
        ) VALUES (
            v_attendance_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            'Realizada',
            NOW()
        );

        -- Marcar como persistido
        UPDATE import_historical_records
        SET persisted = TRUE,
            persisted_attendance_id = v_attendance_id
        WHERE id = v_record.id;

        v_imported_count := v_imported_count + 1;
    END LOOP;

    -- Finalizar o Batch
    UPDATE import_batches
    SET status = 'completed',
        completed_at = NOW(),
        rows_approved = v_imported_count
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'imported', v_imported_count
    );
END;
$function$;

-- Migration: 20260517162427_add_is_historical_to_competences
ALTER TABLE public.competences ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

-- Migration: 20260517162610_update_validate_historical_records_arbitration
CREATE OR REPLACE FUNCTION public.validate_historical_records(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = 'resolved'
          AND (match_notes IS NULL OR match_notes NOT LIKE 'Aprovação de Arbitragem%')
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := '[]'::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-001');
            v_details := v_details || jsonb_build_object('code', 'BR-001', 'message', 'Paciente não está ativo no sistema');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-002');
            v_details := v_details || jsonb_build_object('code', 'BR-002', 'message', 'Profissional não está ativo no sistema');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-003');
            v_details := v_details || jsonb_build_object('code', 'BR-003', 'message', 'Clínica não está ativa no sistema');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        v_conflict_msg := public.check_attendance_session_conflicts(
            NULL, 
            NULL,
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010');
            v_details := v_details || jsonb_build_object('code', 'BR-010', 'message', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, 'BR-010-INT');
            v_details := v_details || jsonb_build_object('code', 'BR-010-INT', 'message', 'Conflito de horário detectado dentro desta planilha para o mesmo profissional');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN 'glossed' ELSE 'approved' END
        WHERE id = v_record.id;

    END LOOP;

    -- Recalcular estatísticas reais incluindo arbitrados
    SELECT 
        count(*) FILTER (WHERE validation_status = 'approved'),
        count(*) FILTER (WHERE validation_status = 'glossed')
    INTO v_validated_count, v_error_count
    FROM import_historical_records
    WHERE import_batch_id = p_batch_id
      AND match_status = 'resolved';

    RETURN jsonb_build_object(
        'validated', COALESCE(v_validated_count, 0),
        'errors', COALESCE(v_error_count, 0)
    );
END;
$function$;

-- Migration: 20260519024305_add_contracts_table_and_balances
-- ==========================================
-- FASE 1: CRIAÇÃO DA TABELA DE CONTRATOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_clinic_contract UNIQUE (clinic_id, contract_number)
);

-- Habilitar RLS Rígido (Padrão de Segurança SisTEA)
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Excluir políticas se já existirem (Garantir idempotência)
DROP POLICY IF EXISTS "Admin full access contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users view own contracts" ON public.contracts;

-- Criar as Políticas de Segurança
CREATE POLICY "Admin full access contracts" 
ON public.contracts FOR ALL USING (public.get_user_role() = 'SMS_ADMIN');

CREATE POLICY "Users view own contracts" 
ON public.contracts FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- ==========================================
-- FASE 2: ADAPTAÇÃO DOS PREÇOS (ITENS DO CONTRATO)
-- ==========================================
ALTER TABLE public.clinic_procedure_prices
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quantidade_contratada INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantidade_saldo INTEGER NOT NULL DEFAULT 0;

-- ==========================================
-- FASE 3: MIGRAR DADOS HISTÓRICOS AUTOMATICAMENTE
-- ==========================================
DO $$
DECLARE
    rec RECORD;
    v_contract_id UUID;
    v_valid_from DATE;
    v_valid_to DATE;
BEGIN
    FOR rec IN 
        SELECT DISTINCT clinic_id, contract_number 
        FROM public.clinic_procedure_prices 
        WHERE contract_number IS NOT NULL AND contract_number <> ''
    LOOP
        -- Se já existir um contrato para esta clínica e número, não duplicamos
        SELECT id INTO v_contract_id
        FROM public.contracts
        WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number;

        IF v_contract_id IS NULL THEN
            -- Identificar os extremos de validade dos procedimentos vinculados
            SELECT MIN(valid_from), MAX(valid_to)
            INTO v_valid_from, v_valid_to
            FROM public.clinic_procedure_prices
            WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number;

            -- Inserir o contrato pai
            INSERT INTO public.contracts (clinic_id, contract_number, valid_from, valid_to, valor_total, valor_saldo, active)
            VALUES (
                rec.clinic_id, 
                rec.contract_number, 
                COALESCE(v_valid_from, CURRENT_DATE), 
                v_valid_to, 
                0.00,
                0.00,
                true
            )
            RETURNING id INTO v_contract_id;
        END IF;

        -- Associar os itens de precificação ao contrato correspondente
        UPDATE public.clinic_procedure_prices
        SET contract_id = v_contract_id
        WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number AND contract_id IS NULL;
    END LOOP;
END $$;

-- ==========================================
-- FASE 4: OTIMIZAÇÃO E PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_attendances_contract_validation 
ON public.attendances (clinic_id, procedure_id, status, attendance_date);

-- Migration: 20260519024345_add_contract_concurrency_functions
-- =========================================================================
-- FUNÇÃO DE DEDUÇÃO DE BALANÇOS COM LOCKING PESSIMISTA (PREVENÇÃO DE RACE CONDITIONS)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deduct_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    v_item RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id, valor_saldo, valor_total INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato não encontrado.';
    END IF;

    -- 2. Validar teto financeiro
    IF p_total_value > v_current_contract.valor_saldo THEN
        RAISE EXCEPTION 'Estouro de saldo financeiro do contrato.';
    END IF;

    -- 3. Deduzir do saldo do contrato
    UPDATE public.contracts
    SET valor_saldo = valor_saldo - p_total_value
    WHERE id = p_contract_id;

    -- 4. Validar e deduzir tetos físicos
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            -- Bloqueia a linha do procedimento para escrita concorrente
            SELECT id, quantidade_saldo INTO v_item
            FROM public.clinic_procedure_prices
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i]
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Procedimento não pactuado no contrato.';
            END IF;

            IF p_procedure_counts[i] > v_item.quantidade_saldo THEN
                RAISE EXCEPTION 'Estouro de saldo de quantidade para o procedimento.';
            END IF;

            -- Deduzir do saldo físico
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
            WHERE id = v_item.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- FUNÇÃO DE REESTORNO DE BALANÇOS (CASO A COMPETÊNCIA SEJA REABERTA)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.refund_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF FOUND THEN
        -- Reestornar valor financeiro
        UPDATE public.contracts
        SET valor_saldo = valor_saldo + p_total_value
        WHERE id = p_contract_id;
    END IF;

    -- 2. Reestornar quantidades físicas
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo + p_procedure_counts[i]
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i];
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260519041845_add_funding_split_to_billing_report
-- =========================================================================
-- MIGRATION: Adiciona desmembramento de recursos (SUS vs RP) no Relatório de Faturamento
-- =========================================================================

-- 1. Atualizar overload com paginação (9 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT 'official'::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
    AND (
      CASE 
        WHEN p_mode = 'official' THEN s.status = 'Realizada'
        WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
        ELSE TRUE 
      END
    );

  -- Busca dos dados com limite/offset e cálculo de desmembramento SUS e Recurso Próprio (RP)
  SELECT json_agg(rows) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      COALESCE(cpp.valor_sus, proc.valor_sus) as valor_sus,
      COALESCE(cpp.valor_rp, proc.valor_rp) as valor_rp,
      COALESCE(cpp.valor_total, proc.valor_total) as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
    LIMIT p_limit
    OFFSET p_offset
  ) rows;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', COALESCE(v_total, 0)
  );
END;
$function$;


-- 2. Atualizar overload sem paginação (7 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT 'official'::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      COALESCE(cpp.valor_sus, proc.valor_sus) as valor_sus,
      COALESCE(cpp.valor_rp, proc.valor_rp) as valor_rp,
      COALESCE(cpp.valor_total, proc.valor_total) as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = 'official' THEN s.status = 'Realizada'
          WHEN p_mode = 'preview' THEN s.status IN ('Realizada', 'Pendente')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- Migration: 20260519043558_create_view_competence_billing_sums
CREATE OR REPLACE VIEW public.view_competence_billing_sums AS
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

-- Migration: 20260519211226_allow_negative_procedure_balances
-- =========================================================================
-- FUNÇÃO DE DEDUÇÃO DE BALANÇOS COM LOCKING PESSIMISTA (PERMITE QUANTIDADE NEGATIVA)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deduct_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    v_item RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id, valor_saldo, valor_total INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato não encontrado.';
    END IF;

    -- 2. Validar teto financeiro (Hard Lock)
    IF p_total_value > v_current_contract.valor_saldo THEN
        RAISE EXCEPTION 'Estouro de saldo financeiro do contrato.';
    END IF;

    -- 3. Deduzir do saldo do contrato
    UPDATE public.contracts
    SET valor_saldo = valor_saldo - p_total_value
    WHERE id = p_contract_id;

    -- 4. Deduzir do saldo físico (permitindo saldo negativo)
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            -- Bloqueia a linha do procedimento para escrita concorrente
            SELECT id, quantidade_saldo INTO v_item
            FROM public.clinic_procedure_prices
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i]
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Procedimento não pactuado no contrato.';
            END IF;

            -- Deduzir do saldo físico diretamente (sem bloquear se ultrapassar)
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
            WHERE id = v_item.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clean all public and auth tables of any default/seed records
TRUNCATE TABLE supabase_migrations.schema_migrations CASCADE;
TRUNCATE TABLE auth.users CASCADE;
TRUNCATE TABLE auth.identities CASCADE;
TRUNCATE TABLE public.attendance_sessions, public.attendances, public.audit_logs, public.cid, public.clinic_procedure_prices, public.clinics, public.competence_audit_logs, public.competences, public.contracts, public.import_batches, public.import_historical_records, public.patient_clinics, public.patients, public.procedure_cid, public.procedure_service_classifications, public.procedure_specialties, public.procedures, public.professional_clinics, public.professional_specialties, public.professionals, public.report_requests, public.service_classifications, public.specialties, public.system_metadata, public.system_settings, public.users CASCADE;

-- 4. Populate migration history ledger
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313000227', 'initial_schema', ARRAY['-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Clínicas
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnes TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- 3. Tabela de Usuários (Extende auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN (''SMS_ADMIN'', ''CLINIC_USER'')),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- Restrição: Usuários de clínica precisam estar vinculados a uma clínica.
ALTER TABLE public.users ADD CONSTRAINT clinic_user_must_have_clinic CHECK (
    (role = ''SMS_ADMIN'') OR 
    (role = ''CLINIC_USER'' AND clinic_id IS NOT NULL)
);

-- 4. Tabela de Profissionais
CREATE TABLE public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cns TEXT NOT NULL UNIQUE,
    cbo TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- 5. Tabela de Pacientes
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cns_patient TEXT NOT NULL UNIQUE,
    mother_name TEXT,
    address TEXT,
    city TEXT,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT,
    race_color TEXT,
    cep TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- 6. Tabela de Procedimentos
CREATE TABLE public.procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    valor_sus NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_rp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(10, 2) GENERATED ALWAYS AS (valor_sus + valor_rp) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- 7. Tabela de Atendimentos (Frequência)
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    cid TEXT NOT NULL,
    auth_number TEXT,
    month_year TEXT NOT NULL, -- Exemplo: ''03/2026'' ou ''2026-03''
    status TEXT NOT NULL CHECK (status IN (''REALIZADO'', ''GLOSADO'', ''PENDENTE'')) DEFAULT ''PENDENTE'',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL,
    CONSTRAINT valid_time CHECK (start_time < end_time)
);

--=========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
--=========================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id() RETURNS UUID AS $$
  SELECT clinic_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies: Clinics
CREATE POLICY "Admin full access clinics" ON public.clinics FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');
CREATE POLICY "Users view own clinic" ON public.clinics FOR SELECT USING (id = public.get_user_clinic_id());

-- Policies: Users
CREATE POLICY "Admin full access users" ON public.users FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');
CREATE POLICY "Users view users from same clinic" ON public.users FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- Policies: Professionals
CREATE POLICY "View professionals" ON public.professionals FOR SELECT USING (auth.role() = ''authenticated'');
CREATE POLICY "Admin full access professionals" ON public.professionals FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

-- Policies: Patients
CREATE POLICY "View patients" ON public.patients FOR SELECT USING (auth.role() = ''authenticated'');
CREATE POLICY "Insert patients" ON public.patients FOR INSERT WITH CHECK (auth.role() = ''authenticated'');
CREATE POLICY "Update patients" ON public.patients FOR UPDATE USING (auth.role() = ''authenticated'');
CREATE POLICY "Admin delete patients" ON public.patients FOR DELETE USING (public.get_user_role() = ''SMS_ADMIN'');

-- Policies: Procedures
CREATE POLICY "View procedures" ON public.procedures FOR SELECT USING (auth.role() = ''authenticated'');
CREATE POLICY "Admin full procedures" ON public.procedures FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

-- Policies: Attendances
CREATE POLICY "Admin full attendances" ON public.attendances FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');
CREATE POLICY "Clinic users view own attendances" ON public.attendances FOR SELECT USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users insert own attendances" ON public.attendances FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users update own attendances" ON public.attendances FOR UPDATE USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic users delete own attendances" ON public.attendances FOR DELETE USING (clinic_id = public.get_user_clinic_id());
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313005618', 'add_clinic_fields', ARRAY['ALTER TABLE public.clinics DROP COLUMN IF EXISTS cnes CASCADE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS cnpj TEXT UNIQUE;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS corporate_name TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS email TEXT;
NOTIFY pgrst, ''reload schema'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313010616', 'add_cnes_to_clinics_v2', ARRAY['ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS cnes TEXT;
NOTIFY pgrst, ''reload schema'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313011850', 'add_specialties_and_fix_professionals', ARRAY['-- Nova tabela de Especialidades
CREATE TABLE public.specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cbo TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
);

-- Habilitar RLS para Especialidades
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Políticas para Especialidades
CREATE POLICY "View specialties" ON public.specialties FOR SELECT USING (auth.role() = ''authenticated'');
CREATE POLICY "Admin full access specialties" ON public.specialties FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

-- Ajustes na tabela de Profissionais
ALTER TABLE public.professionals 
  ADD COLUMN IF NOT EXISTS specialty_id UUID REFERENCES public.specialties(id),
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Remover restrições de CNS e CBO (tornar opcional e remover UNIQUE de CNS se existir para bater com o Form)
ALTER TABLE public.professionals ALTER COLUMN cns DROP NOT NULL;
ALTER TABLE public.professionals DROP CONSTRAINT IF EXISTS professionals_cns_key;
ALTER TABLE public.professionals ALTER COLUMN cbo DROP NOT NULL;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313013457', 'add_name_and_active_to_procedures', ARRAY['ALTER TABLE public.procedures ADD COLUMN name TEXT NOT NULL DEFAULT '''';
ALTER TABLE public.procedures ALTER COLUMN name DROP DEFAULT;
ALTER TABLE public.procedures ADD COLUMN active BOOLEAN DEFAULT true;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313014547', 'add_missing_patient_columns', ARRAY['ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS medical_record_number TEXT,
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

-- Log de migração concluído
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313021410', 'add_notes_and_value_to_attendances', ARRAY['ALTER TABLE public.attendances 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS value_applied NUMERIC DEFAULT 0;

-- Atualizar constraint de status para incluir os valores do frontend
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
ALTER TABLE public.attendances 
ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY[''REALIZADO''::text, ''GLOSADO''::text, ''PENDENTE''::text, ''present''::text, ''absent_justified''::text, ''absent_unjustified''::text]));']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313021425', 'make_attendance_columns_nullable_and_update_status', ARRAY['-- Tornar colunas não presentes no formulário no momento opcionais no banco
ALTER TABLE public.attendances 
ALTER COLUMN start_time DROP NOT NULL,
ALTER COLUMN end_time DROP NOT NULL,
ALTER COLUMN cid DROP NOT NULL,
ALTER COLUMN month_year DROP NOT NULL;

-- Garantir que a coluna status aceite os valores do frontend se ainda não estiver correto
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
ALTER TABLE public.attendances 
ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY[''REALIZADO''::text, ''GLOSADO''::text, ''PENDENTE''::text, ''present''::text, ''absent_justified''::text, ''absent_unjustified''::text]));']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313030737', 'professional_clinics_m2m', ARRAY['-- 1. Create the junction table
CREATE TABLE public.professional_clinics (
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, clinic_id)
);

-- 2. Migrate existing associations
INSERT INTO public.professional_clinics (professional_id, clinic_id)
SELECT id, clinic_id FROM public.professionals WHERE clinic_id IS NOT NULL;

-- 3. Drop the clinic_id column from professionals
ALTER TABLE public.professionals DROP COLUMN clinic_id;

-- 4. Enable RLS on the new table
ALTER TABLE public.professional_clinics ENABLE ROW LEVEL SECURITY;

-- 5. Policies for professional_clinics
CREATE POLICY "Admin full access professional_clinics" ON public.professional_clinics FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');
CREATE POLICY "Clinic users view professional_clinics from same clinic" ON public.professional_clinics FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- 6. Update professionals RLS policies
-- Since professionals are now shared across clinics, let''s ensure clinic users can still see them if associated.
-- The existing policy "View professionals" is: auth.role() = ''authenticated''
-- If we want to restrict it:
-- DROP POLICY "View professionals" ON public.professionals;
-- CREATE POLICY "View professionals" ON public.professionals FOR SELECT 
-- USING (
--   public.get_user_role() = ''SMS_ADMIN'' OR 
--   EXISTS (
--     SELECT 1 FROM public.professional_clinics pc 
--     WHERE pc.professional_id = public.professionals.id 
--     AND pc.clinic_id = public.get_user_clinic_id()
--   )
-- );
-- But wait, get_user_role/clinic_id might not be defined for everyone yet.
-- I''ll check if those functions exist.
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313033744', 'add_frequency_control_sessions', ARRAY['-- Add missing columns to attendances (acting as the main Frequency Control sheet)
ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS authorization_date date,
ADD COLUMN IF NOT EXISTS authorized_quantity integer NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS attendance_character text;

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    attendance_id uuid NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
    session_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status text NOT NULL DEFAULT ''Realizada'',
    created_at timestamp with time zone NULL DEFAULT timezone(''utc''::text, now()),
    updated_at timestamp with time zone NULL DEFAULT timezone(''utc''::text, now()),
    CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id)
);

-- RLS Policies for attendance_sessions
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."attendance_sessions";
CREATE POLICY "Enable read access for all users" ON "public"."attendance_sessions"
FOR SELECT USING (true);

-- Insert policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."attendance_sessions"
FOR INSERT WITH CHECK (auth.role() = ''authenticated'');

-- Update policies
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable update for authenticated users only" ON "public"."attendance_sessions"
FOR UPDATE USING (auth.role() = ''authenticated'');

-- Delete policies
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."attendance_sessions";
CREATE POLICY "Enable delete for authenticated users only" ON "public"."attendance_sessions"
FOR DELETE USING (auth.role() = ''authenticated'');

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON attendance_sessions;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313132338', 'add_active_to_users', ARRAY['ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313135926', 'add_active_to_specialties', ARRAY['ALTER TABLE public.specialties ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313140717', 'add_cpf_to_professionals', ARRAY['ALTER TABLE public.professionals ADD COLUMN cpf TEXT UNIQUE;
-- CNS is already unique, but let''s make sure it''s enforced if it wasn''t
ALTER TABLE public.professionals ADD CONSTRAINT professionals_cns_key UNIQUE (cns);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313141621', 'professional_multiple_specialties', ARRAY['CREATE TABLE public.professional_specialties (
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, specialty_id)
);

-- Enable RLS
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View professional_specialties" ON public.professional_specialties FOR SELECT USING (auth.role() = ''authenticated'');
CREATE POLICY "Admin full access professional_specialties" ON public.professional_specialties FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

-- Migrate existing data from professionals.specialty_id
INSERT INTO public.professional_specialties (professional_id, specialty_id)
SELECT id, specialty_id FROM public.professionals WHERE specialty_id IS NOT NULL;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313150638', 'add_procedure_specialties_v2', ARRAY['CREATE TABLE IF NOT EXISTS public.procedure_specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL,
    UNIQUE(procedure_id, specialty_id)
);

-- Enable RLS
ALTER TABLE public.procedure_specialties ENABLE ROW LEVEL SECURITY;

-- Basic Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = ''procedure_specialties'' AND policyname = ''Allow all on procedure_specialties'') THEN
        CREATE POLICY "Allow all on procedure_specialties" ON public.procedure_specialties FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313200857', 'allow_null_procedure_code', ARRAY['ALTER TABLE public.procedures ALTER COLUMN code DROP NOT NULL;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260313205203', 'fix_professionals_rls_for_clinic_users', ARRAY['-- Enable insert/update for authenticated users on professionals
CREATE POLICY "Insert professionals authenticated" ON public.professionals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update professionals authenticated" ON public.professionals FOR UPDATE TO authenticated USING (true);

-- Enable management of clinic associations
CREATE POLICY "Insert professional_clinics authenticated" ON public.professional_clinics FOR INSERT TO authenticated WITH CHECK (
  (get_user_role() = ''SMS_ADMIN'') OR (clinic_id = get_user_clinic_id())
);
CREATE POLICY "Delete professional_clinics authenticated" ON public.professional_clinics FOR DELETE TO authenticated USING (
  (get_user_role() = ''SMS_ADMIN'') OR (clinic_id = get_user_clinic_id())
);

-- Enable management of specialty associations
CREATE POLICY "Insert professional_specialties authenticated" ON public.professional_specialties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete professional_specialties authenticated" ON public.professional_specialties FOR DELETE TO authenticated USING (true);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260326145705', 'add_justification_to_attendance_sessions', ARRAY['ALTER TABLE public.attendance_sessions ADD COLUMN justification TEXT;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260430022831', 'add_clinic_contracts_and_competences', ARRAY['-- 1. Add closing_day to clinics
ALTER TABLE clinics ADD COLUMN closing_day INTEGER DEFAULT 25;

-- 2. Create clinic_procedure_prices table
CREATE TABLE clinic_procedure_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
    valor_sus NUMERIC NOT NULL DEFAULT 0,
    valor_rp NUMERIC NOT NULL DEFAULT 0,
    valor_total NUMERIC GENERATED ALWAYS AS (valor_sus + valor_rp) STORED,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
    CONSTRAINT clinic_procedure_dates_check CHECK (valid_to IS NULL OR valid_from <= valid_to)
);

ALTER TABLE clinic_procedure_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access procedure prices" ON clinic_procedure_prices
  FOR ALL USING (get_user_role() = ''SMS_ADMIN'');

CREATE POLICY "Users view own clinic procedure prices" ON clinic_procedure_prices
  FOR SELECT USING (clinic_id = get_user_clinic_id());

-- 3. Create competences table
CREATE TABLE competences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT ''ABERTA'' CHECK (status IN (''ABERTA'', ''FECHADA'')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now()),
    UNIQUE(clinic_id, month, year)
);

ALTER TABLE competences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access competences" ON competences
  FOR ALL USING (get_user_role() = ''SMS_ADMIN'');

CREATE POLICY "Users view own clinic competences" ON competences
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Users update own clinic competences" ON competences
  FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- Also allow inserting in case they create it upon closing
CREATE POLICY "Users insert own clinic competences" ON competences
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260430025446', 'update_contracts_for_bulk', ARRAY['ALTER TABLE clinic_procedure_prices 
ADD COLUMN contract_number TEXT,
ADD COLUMN active BOOLEAN DEFAULT TRUE;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260430032857', 'add_competence_days_to_clinics', ARRAY['ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS competence_end_day INTEGER DEFAULT 31,
ADD COLUMN IF NOT EXISTS competence_deadline_day INTEGER DEFAULT 5;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260502221112', 'add_session_validation', ARRAY['
-- Add auth_token field to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS auth_token TEXT,
ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Generate tokens for existing patients that don''t have one
UPDATE patients
SET auth_token = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, ''0''),
    token_updated_at = NOW()
WHERE auth_token IS NULL;

-- Make auth_token NOT NULL after backfill
ALTER TABLE patients ALTER COLUMN auth_token SET NOT NULL;

-- Ensure unique tokens across all patients
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_auth_token ON patients(auth_token);

-- Add validation/audit fields to attendance_sessions
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS validation_ip TEXT,
ADD COLUMN IF NOT EXISTS validation_ua TEXT,
ADD COLUMN IF NOT EXISTS validation_geo JSONB,
ADD COLUMN IF NOT EXISTS validation_nonce TEXT,
ADD COLUMN IF NOT EXISTS validation_attempts INTEGER DEFAULT 0;

-- Add justification column if not exists
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS justification TEXT;

-- Trigger to prevent clinic users from modifying tokens
CREATE OR REPLACE FUNCTION prevent_token_update_by_clinic_user()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.auth_token IS DISTINCT FROM NEW.auth_token THEN
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != ''SMS_ADMIN'' THEN
      RAISE EXCEPTION ''Apenas administradores podem alterar o token do paciente'';
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

-- Index for faster validation lookups
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_validation_nonce 
  ON attendance_sessions(validation_nonce) WHERE validation_nonce IS NOT NULL;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260503010654', 'multi_clinic_patient_setup', ARRAY['
-- 1. Criar a tabela de junção
CREATE TABLE IF NOT EXISTS patient_clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(patient_id, clinic_id)
);

-- 2. Migrar dados existentes da tabela patients para patient_clinics
INSERT INTO patient_clinics (patient_id, clinic_id, active)
SELECT id, clinic_id, active
FROM patients
WHERE clinic_id IS NOT NULL
ON CONFLICT (patient_id, clinic_id) DO NOTHING;

-- 3. Habilitar RLS na nova tabela
ALTER TABLE patient_clinics ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para patient_clinics
DROP POLICY IF EXISTS "CLINIC_USER see own patient links" ON patient_clinics;
CREATE POLICY "CLINIC_USER see own patient links"
ON patient_clinics FOR SELECT
USING (
    get_user_role() = ''SMS_ADMIN''
    OR clinic_id = get_user_clinic_id()
);

DROP POLICY IF EXISTS "CLINIC_USER insert own patient links" ON patient_clinics;
CREATE POLICY "CLINIC_USER insert own patient links"
ON patient_clinics FOR INSERT
WITH CHECK (
    get_user_role() = ''SMS_ADMIN''
    OR clinic_id = get_user_clinic_id()
);

-- 5. Atualizar as políticas da tabela patients
-- Primeiro removemos a antiga que restringia apenas por patients.clinic_id
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON patients;

-- Nova política de SELECT: Pode ver se for ADMIN ou se houver vínculo na tabela de junção (ou no campo antigo)
CREATE POLICY "CLINIC_USER see linked patients"
ON patients FOR SELECT
USING (
    get_user_role() = ''SMS_ADMIN''
    OR EXISTS (
        SELECT 1 FROM patient_clinics
        WHERE patient_clinics.patient_id = patients.id
        AND patient_clinics.clinic_id = get_user_clinic_id()
    )
    OR patients.clinic_id = get_user_clinic_id()
);

-- Nova política de UPDATE
CREATE POLICY "CLINIC_USER update linked patients"
ON patients FOR UPDATE
USING (
    get_user_role() = ''SMS_ADMIN''
    OR EXISTS (
        SELECT 1 FROM patient_clinics
        WHERE patient_clinics.patient_id = patients.id
        AND patient_clinics.clinic_id = get_user_clinic_id()
    )
    OR patients.clinic_id = get_user_clinic_id()
);

-- Nova política de INSERT: Permite que usuários de clínica insiram novos pacientes
-- A validação de unicidade do CNS continuará barrando duplicatas no banco
CREATE POLICY "CLINIC_USER insert patients"
ON patients FOR INSERT
WITH CHECK (
    get_user_role() = ''SMS_ADMIN''
    OR get_user_role() = ''CLINIC_USER''
);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260503013532', 'add_update_policy_patient_clinics', ARRAY['
CREATE POLICY "CLINIC_USER update own patient links"
ON patient_clinics FOR UPDATE
USING (
    get_user_role() = ''SMS_ADMIN''
    OR clinic_id = get_user_clinic_id()
);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260503172217', 'add_clinic_coordinates_v2', ARRAY['-- Add latitude and longitude to clinics table for geofencing
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Comment for documentation
COMMENT ON COLUMN clinics.latitude IS ''Clinic latitude for audit geofencing'';
COMMENT ON COLUMN clinics.longitude IS ''Clinic longitude for audit geofencing'';
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260503172303', 'add_geofencing_fields_to_sessions', ARRAY['-- Add geofencing audit fields to attendance_sessions
ALTER TABLE attendance_sessions 
ADD COLUMN IF NOT EXISTS validation_distance DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS is_out_of_range BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN attendance_sessions.validation_distance IS ''Distance in meters between signature point and clinic'';
COMMENT ON COLUMN attendance_sessions.is_out_of_range IS ''True if the distance exceeds the security threshold (e.g. 500m)'';
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260503173557', 'create_system_settings_v2', ARRAY['-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description)
VALUES 
(''enable_token_rotation'', ''false'', ''Enable automatic patient token rotation after successful validation'')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- SMS_ADMIN full access to settings (using public.users table)
CREATE POLICY "SMS_ADMIN full access to settings" 
ON system_settings 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ''SMS_ADMIN''
  )
);

-- CLINIC_USER read only access to settings
CREATE POLICY "CLINIC_USER read only access to settings" 
ON system_settings 
FOR SELECT 
TO authenticated 
USING (true);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512014809', 'fix_security_and_performance_phase_1', ARRAY['-- 1. Unificar Status em attendances
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_status_check;

UPDATE attendances SET status = ''Realizada'' WHERE status IN (''REALIZADO'', ''present'');
UPDATE attendances SET status = ''Pendente'' WHERE status IN (''PENDENTE'');
UPDATE attendances SET status = ''Glosado'' WHERE status IN (''GLOSADO'');

ALTER TABLE attendances ADD CONSTRAINT attendances_status_check 
  CHECK (status = ANY (ARRAY[''Realizada''::text, ''Pendente''::text, ''Glosado''::text]));

-- 2. Corrigir RLS de Patients (Isolamento de Clínica)
DROP POLICY IF EXISTS "View patients" ON public.patients;
DROP POLICY IF EXISTS "Insert patients" ON public.patients;
DROP POLICY IF EXISTS "Update patients" ON public.patients;
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON public.patients;
DROP POLICY IF EXISTS "SMS_ADMIN full access patients" ON public.patients;

CREATE POLICY "SMS_ADMIN full access patients" 
ON public.patients FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

CREATE POLICY "CLINIC_USER manage own clinic patients" 
ON public.patients FOR ALL 
USING (public.get_user_role() = ''CLINIC_USER'' AND clinic_id = public.get_user_clinic_id());

-- 3. Corrigir RLS de Attendance Sessions (Fim do acesso público)
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."attendance_sessions";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."attendance_sessions";

CREATE POLICY "SMS_ADMIN full access sessions" 
ON public.attendance_sessions FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

CREATE POLICY "CLINIC_USER manage own clinic sessions" 
ON public.attendance_sessions FOR ALL 
USING (
  public.get_user_role() = ''CLINIC_USER'' AND 
  EXISTS (
    SELECT 1 FROM public.attendances a 
    WHERE a.id = attendance_id AND a.clinic_id = public.get_user_clinic_id()
  )
);

-- 4. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_attendances_clinic_id ON public.attendances(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendances_patient_id ON public.attendances(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendances_attendance_date ON public.attendances(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_attendance_id ON public.attendance_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512014903', 'add_dashboard_stats_rpc', ARRAY['CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_clinic_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    ''total_attendances'', COUNT(s.id),
    ''total_value'', COALESCE(SUM(p.valor_total), 0),
    ''digital_validated'', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL),
    ''clinic_stats'', (
      SELECT COALESCE(json_agg(stats), ''[]''::json)
      FROM (
        SELECT 
          c.name,
          COUNT(s2.id) as count,
          COALESCE(SUM(p2.valor_total), 0) as value
        FROM attendance_sessions s2
        JOIN attendances a2 ON s2.attendance_id = a2.id
        JOIN clinics c ON a2.clinic_id = c.id
        JOIN procedures p2 ON a2.procedure_id = p2.id
        WHERE s2.status = ''Realizada''
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
  WHERE s.status = ''Realizada''
  AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  AND (p_start_date IS NULL OR s.session_date >= p_start_date)
  AND (p_end_date IS NULL OR s.session_date <= p_end_date);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015218', 'hardening_phase_3_hashing_and_audit', ARRAY['-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Melhorar a segurança da tabela de pacientes
-- Adicionamos uma coluna para o PIN hashado
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Migramos os PINs existentes para o hash (assumindo que auth_token é o PIN atual)
UPDATE public.patients 
SET pin_hash = crypt(auth_token, gen_salt(''bf''))
WHERE auth_token IS NOT NULL AND pin_hash IS NULL;

-- 3. Adicionar Triggers de Auditoria Automática (Garante log mesmo via Editor SQL)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    description
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME::text,
    CASE 
      WHEN TG_OP = ''DELETE'' THEN OLD.id::text 
      ELSE NEW.id::text 
    END,
    CASE WHEN TG_OP IN (''UPDATE'', ''DELETE'') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN (''INSERT'', ''UPDATE'') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    ''Operação automatizada via trigger de banco de dados''
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoria nas tabelas críticas
DROP TRIGGER IF EXISTS audit_patients ON public.patients;
CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_attendance_sessions ON public.attendance_sessions;
CREATE TRIGGER audit_attendance_sessions AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 4. Otimização de busca de usuário (Index em role e active para middleware)
CREATE INDEX IF NOT EXISTS idx_users_active_role ON public.users(active, role);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015226', 'auto_hash_pin_trigger', ARRAY['CREATE OR REPLACE FUNCTION hash_patient_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_token IS NOT NULL AND (TG_OP = ''INSERT'' OR OLD.auth_token IS DISTINCT FROM NEW.auth_token) THEN
    NEW.pin_hash := crypt(NEW.auth_token, gen_salt(''bf''));
    -- Opcional: NEW.auth_token := NULL; -- Se quisermos remover o texto claro imediatamente
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_hash_patient_pin ON public.patients;
CREATE TRIGGER trg_hash_patient_pin 
BEFORE INSERT OR UPDATE ON public.patients 
FOR EACH ROW EXECUTE FUNCTION hash_patient_pin();
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015233', 'add_verify_pin_rpc', ARRAY['CREATE OR REPLACE FUNCTION verify_patient_pin(
  p_patient_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.patients 
    WHERE id = p_patient_id 
    AND pin_hash = crypt(p_pin, pin_hash)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015301', 'add_report_stats_rpc', ARRAY['CREATE OR REPLACE FUNCTION get_report_stats(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as professional_name,
      p.id as professional_id,
      COUNT(s.id) as session_count,
      SUM(proc.valor_total) as total_value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals p ON a.professional_id = p.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE s.status = ''Realizada''
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    GROUP BY c.name, p.name, p.id
    ORDER BY c.name, SUM(proc.valor_total) DESC
  ) stats;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015315', 'update_report_stats_rpc_clinic_filter', ARRAY['CREATE OR REPLACE FUNCTION get_report_stats(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as professional_name,
      p.id as professional_id,
      COUNT(s.id) as session_count,
      COALESCE(SUM(proc.valor_total), 0) as total_value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals p ON a.professional_id = p.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE s.status = ''Realizada''
    AND (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, p.name, p.id
    ORDER BY c.name, SUM(proc.valor_total) DESC
  ) stats;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015342', 'add_app_audit_log_function', ARRAY['CREATE OR REPLACE FUNCTION log_app_event(
  p_action TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    description,
    new_data
  ) VALUES (
    auth.uid(),
    p_action,
    p_description,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512015403', 'secure_audit_logs_rls', ARRAY['-- Garantir que a tabela de auditoria seja protegida
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores SMS podem ver logs" ON public.audit_logs;
CREATE POLICY "Apenas administradores SMS podem ver logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = ''SMS_ADMIN''
);

-- Impedir qualquer modificação manual dos logs
DROP POLICY IF EXISTS "Ninguém pode alterar logs" ON public.audit_logs;
CREATE POLICY "Ninguém pode alterar logs"
ON public.audit_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Permitir inserção via funções SECURITY DEFINER (como log_app_event)
-- Note: Security Definer functions bypass RLS when executing as the owner
-- but if we want to allow direct insert for some reason, we could add a policy.
-- For now, we restrict all direct mutations.
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512224601', 'fix_attendances_status_constraint_and_default', ARRAY['-- 1. Alterar o valor padrão para ''Pendente'' (PascalCase) para alinhar com o restante do sistema
ALTER TABLE public.attendances ALTER COLUMN status SET DEFAULT ''Pendente'';

-- 2. Atualizar a restrição de verificação para ser mais flexível (ou apenas alinhar com o PascalCase)
-- Primeiro removemos a antiga
ALTER TABLE public.attendances DROP CONSTRAINT IF EXISTS attendances_status_check;

-- Adicionamos a nova, permitindo os valores em PascalCase que o sistema usa
ALTER TABLE public.attendances ADD CONSTRAINT attendances_status_check 
CHECK (status = ANY (ARRAY[''Realizada''::text, ''Pendente''::text, ''Glosado''::text, ''REALIZADO''::text, ''PENDENTE''::text, ''GLOSADO''::text]));

-- 3. Garantir que a tabela attendance_sessions também esteja coerente (opcional, mas bom para consistência)
ALTER TABLE public.attendance_sessions ALTER COLUMN status SET DEFAULT ''Pendente'';
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;
ALTER TABLE public.attendance_sessions ADD CONSTRAINT attendance_sessions_status_check 
CHECK (status = ANY (ARRAY[''Realizada''::text, ''Pendente''::text, ''Glosado''::text]));
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512234400', 'add_attendance_conflict_validation', ARRAY['-- Function to check for attendance session conflicts (BR-001 and BR-002)
CREATE OR REPLACE FUNCTION check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
) RETURNS TEXT AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Get patient and professional for this attendance
  SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
  FROM public.attendances WHERE id = p_attendance_id;

  -- 1. Check Patient Conflict (BR-001)
  -- Checks if this patient is already in another session at the same time
  SELECT ''Paciente já possui atendimento neste horário na clínica '' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-002)
  -- Checks if this professional is already attending someone else at the same time
  SELECT ''O Profissional já possui atendimento neste horário para o paciente '' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$ LANGUAGE plpgsql;

-- Add performance indexes for conflict checking
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_time ON public.attendance_sessions (session_date, start_time, end_time);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260512234419', 'update_attendance_conflict_validation_flexible', ARRAY['-- Dropping the previous version to update parameters
DROP FUNCTION IF EXISTS check_attendance_session_conflicts(UUID, UUID, DATE, TIME, TIME);

-- Updated Function to check for attendance session conflicts (Flexible for new or existing guides)
CREATE OR REPLACE FUNCTION check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
) RETURNS TEXT AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  SELECT ''O Paciente já possui atendimento neste horário na clínica '' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-002)
  SELECT ''O Profissional já possui atendimento neste horário para o paciente '' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$ LANGUAGE plpgsql;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260513005620', 'update_dashboard_stats_rpc', ARRAY['CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_clinic_id uuid, p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    ''total_attendances'', COUNT(DISTINCT a.id),
    ''total_sessions'', COUNT(s.id),
    ''total_value'', COALESCE(SUM(p.valor_total), 0),
    ''digital_validated'', COUNT(s.id) FILTER (WHERE s.validated_at IS NOT NULL),
    ''clinic_stats'', (
      SELECT COALESCE(json_agg(stats), ''[]''::json)
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
        WHERE s2.status = ''Realizada''
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
  WHERE s.status = ''Realizada''
  AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  AND (p_start_date IS NULL OR s.session_date >= p_start_date)
  AND (p_end_date IS NULL OR s.session_date <= p_end_date);

  RETURN v_result;
END;
$function$;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260513010801', 'add_cpf_to_patients', ARRAY['ALTER TABLE public.patients ADD COLUMN cpf TEXT UNIQUE;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260513024022', 'optimize_and_fix_conflict_checks', ARRAY['-- 1. Create missing index for professional conflict optimization
CREATE INDEX IF NOT EXISTS idx_attendances_professional_id ON public.attendances (professional_id);

-- 2. Update the conflict check function to be more explicit and robust
CREATE OR REPLACE FUNCTION public.check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME WITHOUT TIME ZONE,
  p_end TIME WITHOUT TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL AND (p_patient_id IS NULL OR p_professional_id IS NULL) THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  -- Ensure the patient doesn''t have overlapping sessions
  SELECT ''O Paciente já possui atendimento neste horário na clínica '' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    -- Important: status check can be added here if we decide to ignore some statuses
    -- but per discussion, we keep all current statuses as "occupied"
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-010)
  -- Ensure the professional is not busy with ANY other patient at this time
  SELECT ''O Profissional já está ocupado com outro paciente ('' || p.name || '') neste horário.''
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260513024547', 'include_clinic_in_conflict_message', ARRAY['CREATE OR REPLACE FUNCTION public.check_attendance_session_conflicts(
  p_session_id UUID,
  p_attendance_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start TIME WITHOUT TIME ZONE,
  p_end TIME WITHOUT TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_professional_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Determine patient and professional IDs
  IF p_attendance_id IS NOT NULL AND (p_patient_id IS NULL OR p_professional_id IS NULL) THEN
    SELECT patient_id, professional_id INTO v_patient_id, v_professional_id
    FROM public.attendances WHERE id = p_attendance_id;
  ELSE
    v_patient_id := p_patient_id;
    v_professional_id := p_professional_id;
  END IF;

  -- 1. Check Patient Conflict (BR-001)
  SELECT ''O Paciente já possui atendimento neste horário na clínica '' || c.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.patient_id = v_patient_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  IF v_conflict_info IS NOT NULL THEN
    RETURN v_conflict_info;
  END IF;

  -- 2. Check Professional Conflict (BR-010) - Now with Clinic Name
  SELECT ''O Profissional já está ocupado na clínica '' || c.name || '' com o paciente '' || p.name
  INTO v_conflict_info
  FROM public.attendance_sessions s
  JOIN public.attendances a ON s.attendance_id = a.id
  JOIN public.patients p ON a.patient_id = p.id
  JOIN public.clinics c ON a.clinic_id = c.id
  WHERE a.professional_id = v_professional_id
    AND s.session_date = p_date
    AND s.id != COALESCE(p_session_id, ''00000000-0000-0000-0000-000000000000''::uuid)
    AND (s.start_time, s.end_time) OVERLAPS (p_start, p_end)
  LIMIT 1;

  RETURN v_conflict_info;
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260514031719', 'add_professional_cbo_to_attendances', ARRAY['ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS professional_cbo text;
COMMENT ON COLUMN public.attendances.professional_cbo IS ''CBO (Classificação Brasileira de Ocupações) utilized by the professional for this specific attendance.'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260514200647', 'restrict_professional_registration_to_admin_v2', ARRAY['-- Remove permissões de inserção e atualização de profissionais para usuários que não sejam SMS_ADMIN
DROP POLICY IF EXISTS "CLINIC_USER insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER update professionals" ON public.professionals;

-- Nota: A política "CLINIC_USER view own clinic professionals" é mantida para permitir 
-- que usuários de clínicas continuem selecionando profissionais em formulários de atendimento.
-- A política "SMS_ADMIN full access professionals" garante que administradores continuem com acesso total.
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260515220016', 'create_service_classifications', ARRAY['CREATE TABLE public.service_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_code text NOT NULL,
  classification_code text NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone(''utc''::text, now()),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.service_classifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.service_classifications
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only" ON public.service_classifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  );

CREATE POLICY "Enable update for admin users only" ON public.service_classifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  );

CREATE POLICY "Enable delete for admin users only" ON public.service_classifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  );

-- Insert initial data
INSERT INTO public.service_classifications (service_code, classification_code, name) VALUES
(''113'', ''001'', ''Assitência Domiciliar (Serviço de Atenção Domiciliar)''),
(''113'', ''002'', ''Internação Domiciliar (Serviço de Atenção Domiciliar)''),
(''135'', ''001'', ''Reabilitação Visual (Serviço de Reabilitação)''),
(''135'', ''002'', ''Reabilitação Intelectual (Serviço de Reabilitação)''),
(''135'', ''003'', ''Reabilitação Física (Serviço de Reabilitação)''),
(''113'', ''003'', ''Equipe Multidisciplinar de Atenção Domiciliar - EMAD (Serviço de Atenção Domiciliar)''),
(''113'', ''004'', ''Equipe Multidisciplinar de Apoio - EMAP (Serviço de Atenção Domiciliar)''),
(''135'', ''005'', ''Reabiliatação Auditiva (Serviço de Reabilitação)''),
(''135'', ''010'', ''Atenção Fonoaudiológica (Serviço de Reabilitação)'');
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260515220858', 'create_cid_table', ARRAY['CREATE TABLE public.cid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone(''utc''::text, now()),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.cid ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.cid
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only" ON public.cid
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  );

CREATE POLICY "Enable update for admin users only" ON public.cid
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN''
    )
  );

-- Insert initial data
INSERT INTO public.cid (code, name) VALUES
(''F700'', ''Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F701'', ''Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F708'', ''Retardo mental leve - outros comprometimentos do comportamento''),
(''F709'', ''Retardo mental leve - sem menção de comprometimento do comportamento''),
(''F710'', ''Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F711'', ''Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F718'', ''Retardo mental moderado - outros comprometimentos do comportamento''),
(''F719'', ''Retardo mental moderado - sem menção de comprometimento do comportamento''),
(''F720'', ''Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F721'', ''Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F728'', ''Retardo mental grave - outros comprometimentos do comportamento''),
(''F729'', ''Retardo mental grave - sem menção de comprometimento do comportamento''),
(''F730'', ''Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F731'', ''Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F738'', ''Retardo mental profundo - outros comprometimentos do comportamento''),
(''F739'', ''Retardo mental profundo - sem menção de comprometimento do comportamento''),
(''F780'', ''Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F781'', ''Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F788'', ''Outro retardo mental - outros comprometimentos do comportamento''),
(''F789'', ''Outro retardo mental - sem menção de comprometimento do comportamento''),
(''F790'', ''Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F791'', ''Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F798'', ''Retardo mental não especificado - outros comprometimentos do comportamento''),
(''F799'', ''Retardo mental não especificado - sem menção de comprometimento do comportamento''),
(''F83'', ''Transtornos específicos misto do desenvolvimento''),
(''F840'', ''Autismo infantil''),
(''F841'', ''Autismo atípico''),
(''F842'', ''Síndrome de Rett''),
(''F843'', ''Outro transtorno desintegrativo da infância''),
(''F844'', ''Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados''),
(''F845'', ''Síndrome de asperger''),
(''F848'', ''Outros transtornos globais do desenvolvimento''),
(''F849'', ''Transtornos globais não especificados do desenvolvimento''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada'');
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260515221712', 'link_procedure_with_cid_and_service', ARRAY['CREATE TABLE public.procedure_service_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  service_classification_id uuid NOT NULL REFERENCES public.service_classifications(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone(''utc''::text, now()),
  PRIMARY KEY (id),
  UNIQUE (procedure_id, service_classification_id)
);

CREATE TABLE public.procedure_cid (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  cid_id uuid NOT NULL REFERENCES public.cid(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone(''utc''::text, now()),
  PRIMARY KEY (id),
  UNIQUE (procedure_id, cid_id)
);

ALTER TABLE public.procedure_service_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_cid ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for all" ON public.procedure_service_classifications FOR SELECT USING (true);
CREATE POLICY "Enable read for all" ON public.procedure_cid FOR SELECT USING (true);

CREATE POLICY "Enable all for admin" ON public.procedure_service_classifications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN'')
);
CREATE POLICY "Enable all for admin" ON public.procedure_cid FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = ''SMS_ADMIN'')
);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260515223242', 'add_restrictions_to_procedures', ARRAY['ALTER TABLE public.procedures 
ADD COLUMN max_quantity integer DEFAULT 1,
ADD COLUMN min_age integer,
ADD COLUMN max_age integer;

COMMENT ON COLUMN public.procedures.max_quantity IS ''Maximum quantity allowed for this procedure per attendance session (logic enforced at attendance entry).'';
COMMENT ON COLUMN public.procedures.min_age IS ''Minimum age allowed for this procedure (in years).'';
COMMENT ON COLUMN public.procedures.max_age IS ''Maximum age allowed for this procedure (in years).'';
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260515224831', 'remove_default_max_quantity', ARRAY['ALTER TABLE public.procedures ALTER COLUMN max_quantity DROP DEFAULT;
UPDATE public.procedures SET max_quantity = NULL WHERE max_quantity = 1; -- Reset current "1"s to NULL (unrestricted) as per user feedback
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516001913', 'add_missing_cbos_to_specialties', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231A1'', ''Médico broncoesofalogista''),
(''2231F9'', ''Médico residente''),
(''225103'', ''Médico infectologista''),
(''225105'', ''Médico acupunturista''),
(''225109'', ''Médico nefrologista''),
(''225110'', ''Médico alergista e imunologista''),
(''225112'', ''Médico neurologista''),
(''225115'', ''Médico angiologista''),
(''225118'', ''Médico nutrologista''),
(''225120'', ''Médico cardiologista''),
(''225121'', ''Médico oncologista clínico''),
(''225122'', ''Médico cancerologista pediátrico''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225127'', ''Médico pneumologista''),
(''225130'', ''Médico de família e comunidade''),
(''225133'', ''Médico psiquiatra''),
(''225135'', ''Médico dermatologista''),
(''225136'', ''Médico reumatologista''),
(''225151'', ''Médico anestesiologista''),
(''225154'', ''Médico Antroposófico''),
(''225155'', ''Médico endocrinologista e metabologista''),
(''225160'', ''Médico fisiatra''),
(''225165'', ''Médico gastroenterologista''),
(''225170'', ''Médico generalista''),
(''225175'', ''Médico geneticista''),
(''225180'', ''Médico geriatra''),
(''225185'', ''Médico hematologista''),
(''225195'', ''Médico homeopata''),
(''225203'', ''Médico em cirurgia vascular''),
(''225210'', ''Médico cirurgião cardiovascular''),
(''225215'', ''Médico cirurgião de cabeça e pescoço''),
(''225220'', ''Médico cirurgião do aparelho digestivo''),
(''225225'', ''Médico cirurgião geral''),
(''225230'', ''Médico cirurgião pediátrico''),
(''225235'', ''Médico cirurgião plástico''),
(''225240'', ''Médico cirurgião torácico''),
(''225250'', ''Médico ginecologista e obstetra''),
(''225255'', ''Médico mastologista''),
(''225260'', ''Médico neurocirurgião''),
(''225265'', ''Médico oftalmologista''),
(''225270'', ''Médico ortopedista e traumatologista''),
(''225275'', ''Médico otorrinolaringologista''),
(''225280'', ''Médico coloproctologista''),
(''225285'', ''Médico urologista''),
(''225290'', ''Médico cancerologista cirurgíco''),
(''225315'', ''Médico em medicina nuclear''),
(''225330'', ''Médico radioterapeuta''),
(''225340'', ''Médico hemoterapeuta''),
(''225350'', ''Médico neurofisiologista clínico'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002242', 'add_cbo_categories_to_specialties_2251_2252_2253', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2251'', ''Médicos Clínicos''),
(''2252'', ''Médicos em Especialidades Cirúrgicas''),
(''2253'', ''Médicos em Medicina Diagnóstica e Terapêutica'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002332', 'add_more_cbos_to_specialties_dentists_nurses_etc', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''223208'', ''Cirurgião dentista - clínico geral''),
(''223212'', ''Cirurgião dentista - endodontista''),
(''223220'', ''Cirurgião dentista - estomatologista''),
(''223224'', ''Cirurgião dentista - implantodontista''),
(''223228'', ''Cirurgião dentista - odontogeriatra''),
(''223232'', ''Cirurgião dentista - odontologista legal''),
(''223236'', ''Cirurgião dentista - odontopediatra''),
(''223240'', ''Cirurgião dentista - ortopedista e ortodontista''),
(''223244'', ''Cirurgião dentista - patologista bucal''),
(''223248'', ''Cirurgião dentista - periodontista''),
(''223252'', ''Cirurgião dentista - protesiólogo bucomaxilofacial''),
(''223256'', ''Cirurgião dentista - protesista''),
(''223264'', ''Cirurgião dentista - reabilitador oral''),
(''223268'', ''Cirurgião dentista - traumatologista bucomaxilofacial''),
(''223276'', ''Cirurgião dentista - odontologia do trabalho''),
(''223288'', ''Cirurgião dentista - odontologia para pacientes com necessidades especiais''),
(''223405'', ''Farmacêutico''),
(''223415'', ''Farmacêutico analista clínico''),
(''223445'', ''Farmacêutico hospitalar e clínico''),
(''223505'', ''Enfermeiro''),
(''223520'', ''Enfermeiro de centro cirúrgico''),
(''223525'', ''Enfermeiro de terapia intensiva''),
(''223530'', ''Enfermeiro do trabalho''),
(''223535'', ''Enfermeiro nefrologista''),
(''223540'', ''Enfermeiro neonatologista''),
(''223545'', ''Enfermeiro obstétrico''),
(''223550'', ''Enfermeiro psiquiátrico''),
(''223605'', ''Fisioterapeuta geral''),
(''223640'', ''Fisioterapeuta osteopata''),
(''223660'', ''Fisioterapeuta do trabalho''),
(''223710'', ''Nutricionista''),
(''223905'', ''Terapeuta ocupacional''),
(''224140'', ''Profissional de educação física na saúde''),
(''226305'', ''Musicoterapeuta''),
(''226320'', ''Naturólogo''),
(''239425'', ''Psicopedagogo''),
(''251510'', ''Psicólogo clínico''),
(''251520'', ''Psicólogo hospitalar''),
(''251535'', ''Psicólogo do trânsito''),
(''251540'', ''Psicólogo do trabalho''),
(''251545'', ''Neuropsicólogo''),
(''251550'', ''Psicanalista''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002422', 'add_more_cbos_to_specialties_pedagogue_sanitarian_etc', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231F9'', ''Médico residente''),
(''223605'', ''Fisioterapeuta geral''),
(''223905'', ''Terapeuta ocupacional''),
(''225112'', ''Médico neurologista''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225130'', ''Médico de família e comunidade''),
(''225139'', ''Médico sanitarista''),
(''225142'', ''Médico da estratégia de saúde da família''),
(''225170'', ''Médico generalista''),
(''239415'', ''Pedagogo''),
(''251510'', ''Psicólogo clínico''),
(''251520'', ''Psicólogo hospitalar''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002515', 'add_more_cbos_to_specialties_duplicate_check_4', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231F9'', ''Médico residente''),
(''223605'', ''Fisioterapeuta geral''),
(''223905'', ''Terapeuta ocupacional''),
(''225112'', ''Médico neurologista''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225142'', ''Médico da estratégia de saúde da família''),
(''225170'', ''Médico generalista''),
(''226305'', ''Musicoterapeuta''),
(''226320'', ''Naturólogo''),
(''239415'', ''Pedagogo''),
(''239425'', ''Psicopedagogo''),
(''251510'', ''Psicólogo clínico''),
(''251520'', ''Psicólogo hospitalar''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002611', 'add_cbo_category_2238_fonoaudiologos', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2238'', ''Fonoaudiólogos'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002715', 'add_more_cbos_to_specialties_duplicate_check_5', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231F9'', ''Médico residente''),
(''223405'', ''Farmacêutico''),
(''223505'', ''Enfermeiro''),
(''223605'', ''Fisioterapeuta geral''),
(''223905'', ''Terapeuta ocupacional''),
(''225112'', ''Médico neurologista''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225133'', ''Médico psiquiatra''),
(''225142'', ''Médico da estratégia de saúde da família''),
(''225160'', ''Médico fisiatra''),
(''225170'', ''Médico generalista''),
(''225265'', ''Médico oftalmologista''),
(''225270'', ''Médico ortopedista e traumatologista''),
(''225275'', ''Médico otorrinolaringologista''),
(''225350'', ''Médico neurofisiologista clínico''),
(''226305'', ''Musicoterapeuta''),
(''226320'', ''Naturólogo''),
(''239415'', ''Pedagogo''),
(''251510'', ''Psicólogo clínico''),
(''251520'', ''Psicólogo hospitalar''),
(''251545'', ''Neuropsicólogo''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002754', 'add_more_cbos_to_specialties_duplicate_check_6', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231F9'', ''Médico residente''),
(''223605'', ''Fisioterapeuta geral''),
(''223905'', ''Terapeuta ocupacional''),
(''226320'', ''Naturólogo''),
(''239415'', ''Pedagogo''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002830', 'add_more_cbos_to_specialties_duplicate_check_7', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''2231F9'', ''Médico residente''),
(''223505'', ''Enfermeiro''),
(''223605'', ''Fisioterapeuta geral''),
(''223905'', ''Terapeuta ocupacional''),
(''225112'', ''Médico neurologista''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225142'', ''Médico da estratégia de saúde da família''),
(''225170'', ''Médico generalista''),
(''226305'', ''Musicoterapeuta''),
(''226320'', ''Naturólogo''),
(''239415'', ''Pedagogo''),
(''251510'', ''Psicólogo clínico''),
(''251605'', ''Assistente social'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516002941', 'add_extensive_cbos_to_specialties_final_batch', ARRAY['INSERT INTO specialties (cbo, name) VALUES
(''221205'', ''Biomédico''),
(''2231A1'', ''Médico broncoesofalogista''),
(''2231F8'', ''Médico em medicina preventiva e social''),
(''2231F9'', ''Médico residente''),
(''2231G1'', ''Médico Cardiologista Intervencionista''),
(''223204'', ''Cirurgião dentista - auditor''),
(''223208'', ''Cirurgião dentista - clínico geral''),
(''223212'', ''Cirurgião dentista - endodontista''),
(''223216'', ''Cirurgião dentista - epidemiologista''),
(''223220'', ''Cirurgião dentista - estomatologista''),
(''223224'', ''Cirurgião dentista - implantodontista''),
(''223228'', ''Cirurgião dentista - odontogeriatra''),
(''223232'', ''Cirurgião dentista - odontologista legal''),
(''223236'', ''Cirurgião dentista - odontopediatra''),
(''223240'', ''Cirurgião dentista - ortopedista e ortodontista''),
(''223244'', ''Cirurgião dentista - patologista bucal''),
(''223248'', ''Cirurgião dentista - periodontista''),
(''223252'', ''Cirurgião dentista - protesiólogo bucomaxilofacial''),
(''223256'', ''Cirurgião dentista - protesista''),
(''223260'', ''Cirurgião dentista - radiologista''),
(''223264'', ''Cirurgião dentista - reabilitador oral''),
(''223268'', ''Cirurgião dentista - traumatologista bucomaxilofacial''),
(''223272'', ''Cirurgião dentista de saúde coletiva''),
(''223276'', ''Cirurgião dentista - odontologia do trabalho''),
(''223280'', ''Cirurgião dentista - dentística''),
(''223284'', ''Cirurgião dentista - disfunção temporomandibular e dor orofacial''),
(''223288'', ''Cirurgião dentista - odontologia para pacientes com necessidades especiais''),
(''223293'', ''Cirurgião-dentista da estratégia de saúde da família''),
(''223405'', ''Farmacêutico''),
(''223415'', ''Farmacêutico analista clínico''),
(''223420'', ''Farmacêutico de alimentos''),
(''223425'', ''Farmacêutico práticas integrativas e complementares''),
(''223435'', ''Farmacêutico industrial''),
(''223440'', ''Farmacêutico toxicologista''),
(''223445'', ''Farmacêutico hospitalar e clínico''),
(''223505'', ''Enfermeiro''),
(''223510'', ''Enfermeiro auditor''),
(''223515'', ''Enfermeiro de bordo''),
(''223520'', ''Enfermeiro de centro cirúrgico''),
(''223525'', ''Enfermeiro de terapia intensiva''),
(''223530'', ''Enfermeiro do trabalho''),
(''223535'', ''Enfermeiro nefrologista''),
(''223540'', ''Enfermeiro neonatologista''),
(''223545'', ''Enfermeiro obstétrico''),
(''223550'', ''Enfermeiro psiquiátrico''),
(''223555'', ''Enfermeiro puericultor e pediátrico''),
(''223560'', ''Enfermeiro sanitarista''),
(''223565'', ''Enfermeiro da estratégia de saúde da família''),
(''223570'', ''Perfusionista''),
(''223580'', ''Enfermeiro estomaterapeuta''),
(''223605'', ''Fisioterapeuta geral''),
(''223625'', ''Fisioterapeuta respiratória''),
(''223630'', ''Fisioterapeuta neurofuncional''),
(''223635'', ''Fisioterapeuta traumato-ortopédica funcional''),
(''223640'', ''Fisioterapeuta osteopata''),
(''223645'', ''Fisioterapeuta quiropraxista''),
(''223650'', ''Fisioterapeuta acupunturista''),
(''223655'', ''Fisioterapeuta esportivo''),
(''223660'', ''Fisioterapeuta do trabalho''),
(''2236I1'', ''Técnico em orientação e mobilidade de cegos e deficientes visuais''),
(''223710'', ''Nutricionista''),
(''223810'', ''Fonoaudiólogo geral''),
(''223815'', ''Fonoaudiólogo educacional''),
(''223820'', ''Fonoaudiólogo em audiologia''),
(''223825'', ''Fonoaudiólogo em disfagia''),
(''223830'', ''Fonoaudiólogo em linguagem''),
(''223835'', ''Fonoaudiólogo em motricidade orofacial''),
(''223840'', ''Fonoaudiólogo em saúde coletiva''),
(''223845'', ''Fonoaudiólogo em voz''),
(''223905'', ''Terapeuta ocupacional''),
(''224105'', ''Avaliador físico''),
(''224110'', ''Ludomotricista''),
(''224115'', ''Preparador de atleta''),
(''224120'', ''Preparador físico''),
(''224125'', ''Técnico de desporto individual e coletivo (exceto futebol)''),
(''224130'', ''Técnico de laboratório e fiscalização desportiva''),
(''224135'', ''Treinador profissional de futebol''),
(''224140'', ''Profissional de educação física na saúde''),
(''225103'', ''Médico infectologista''),
(''225105'', ''Médico acupunturista''),
(''225106'', ''Médico legista''),
(''225109'', ''Médico nefrologista''),
(''225110'', ''Médico alergista e imunologista''),
(''225112'', ''Médico neurologista''),
(''225115'', ''Médico angiologista''),
(''225118'', ''Médico nutrologista''),
(''225120'', ''Médico cardiologista''),
(''225121'', ''Médico oncologista clínico''),
(''225122'', ''Médico cancerologista pediátrico''),
(''225124'', ''Médico pediatra''),
(''225125'', ''Médico clínico''),
(''225127'', ''Médico pneumologista''),
(''225130'', ''Médico de família e comunidade''),
(''225133'', ''Médico psiquiatra''),
(''225135'', ''Médico dermatologista''),
(''225136'', ''Médico reumatologista''),
(''225139'', ''Médico sanitarista''),
(''225140'', ''Médico do trabalho''),
(''225142'', ''Médico da estratégia de saúde da família''),
(''225145'', ''Médico em medicina de tráfego''),
(''225148'', ''Médico anatomopatologista''),
(''225150'', ''Médico em medicina intensiva''),
(''225151'', ''Médico anestesiologista''),
(''225154'', ''Médico Antroposófico''),
(''225155'', ''Médico endocrinologista e metabologista''),
(''225160'', ''Médico fisiatra''),
(''225165'', ''Médico gastroenterologista''),
(''225170'', ''Médico generalista''),
(''225175'', ''Médico geneticista''),
(''225180'', ''Médico geriatra''),
(''225185'', ''Médico hematologista''),
(''225195'', ''Médico homeopata''),
(''225203'', ''Médico em cirurgia vascular''),
(''225210'', ''Médico cirurgião cardiovascular''),
(''225215'', ''Médico cirurgião de cabeça e pescoço''),
(''225220'', ''Médico cirurgião do aparelho digestivo''),
(''225225'', ''Médico cirurgião geral''),
(''225230'', ''Médico cirurgião pediátrico''),
(''225235'', ''Médico cirurgião plástico''),
(''225240'', ''Médico cirurgião torácico''),
(''225250'', ''Médico ginecologista e obstetra''),
(''225255'', ''Médico mastologista''),
(''225260'', ''Médico neurocirurgião''),
(''225265'', ''Médico oftalmologista''),
(''225270'', ''Médico ortopedista e traumatologista''),
(''225275'', ''Médico otorrinolaringologista''),
(''225280'', ''Médico coloproctologista''),
(''225285'', ''Médico urologista''),
(''225290'', ''Médico cancerologista cirurgíco''),
(''225295'', ''Médico cirurgião da mão''),
(''225305'', ''Médico citopatologista''),
(''225310'', ''Médico em endoscopia''),
(''225315'', ''Médico em medicina nuclear''),
(''225325'', ''Médico patologista''),
(''225330'', ''Médico radioterapeuta''),
(''225335'', ''Médico patologista clínico / medicina laboratorial''),
(''225340'', ''Médico hemoterapeuta''),
(''225345'', ''Médico hiperbarista''),
(''225350'', ''Médico neurofisiologista clínico''),
(''226105'', ''Quiropraxista''),
(''226110'', ''Osteopata''),
(''226305'', ''Musicoterapeuta''),
(''226310'', ''Arteterapeuta''),
(''226315'', ''Equoterapeuta''),
(''226320'', ''Naturólogo''),
(''234410'', ''Professor de educação física no ensino superior''),
(''234415'', ''Professor de enfermagem do ensino superior''),
(''251505'', ''Psicólogo educacional''),
(''251510'', ''Psicólogo clínico''),
(''251515'', ''Psicólogo do esporte''),
(''251520'', ''Psicólogo hospitalar''),
(''251525'', ''Psicólogo jurídico''),
(''251530'', ''Psicólogo social''),
(''251535'', ''Psicólogo do trânsito''),
(''251540'', ''Psicólogo do trabalho''),
(''251545'', ''Neuropsicólogo''),
(''251550'', ''Psicanalista''),
(''251555'', ''Psicólogo Acupunturista''),
(''251605'', ''Assistente social''),
(''322105'', ''Técnico em acupuntura''),
(''322115'', ''Técnico em quiropraxia''),
(''322120'', ''Massoterapeuta''),
(''322125'', ''Terapeuta holístico''),
(''322205'', ''Técnico de enfermagem''),
(''322210'', ''Técnico de enfermagem de terapia intensiva''),
(''322215'', ''Técnico de enfermagem do trabalho''),
(''322220'', ''Técnico de enfermagem psiquiátrica''),
(''322225'', ''Instrumentador cirúrgico''),
(''322230'', ''Auxiliar de enfermagem''),
(''322235'', ''Auxiliar de enfermagem do trabalho''),
(''322240'', ''Auxiliar de saúde (navegação marítima)''),
(''322245'', ''Técnico de enfermagem da estratégia de saúde da família''),
(''322250'', ''Auxiliar de enfermagem da estratégia de saúde da família''),
(''322405'', ''Técnico em saúde bucal''),
(''322415'', ''Auxiliar em saúde bucal''),
(''322425'', ''Técnico em saúde bucal da estratégia de saúde da família''),
(''322430'', ''Auxiliar em saúde bucal da estratégia de saúde da família''),
(''352210'', ''Agente de saúde pública''),
(''515105'', ''Agente comunitário de saúde''),
(''515110'', ''Atendente de enfermagem''),
(''515115'', ''Parteira leiga''),
(''515120'', ''Visitador sanitário''),
(''515125'', ''Agente indígena de saúde''),
(''515130'', ''Agente indígena de saneamento''),
(''515135'', ''Socorrista (exceto médicos e enfermeiros)''),
(''515140'', ''Agente de Combate às Endemias''),
(''5151F1'', ''Agente de Combate às Endemias''),
(''516220'', ''Cuidador em saúde'')
ON CONFLICT (cbo) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003437', 'add_cids_to_cid_table_batch_1', ARRAY['INSERT INTO cid (code, name) VALUES
(''F700'', ''Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F708'', ''Retardo mental leve - outros comprometimentos do comportamento''),
(''F709'', ''Retardo mental leve - sem menção de comprometimento do comportamento''),
(''F710'', ''Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F711'', ''Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F718'', ''Retardo mental moderado - outros comprometimentos do comportamento''),
(''F719'', ''Retardo mental moderado - sem menção de comprometimento do comportamento''),
(''F720'', ''Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F721'', ''Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F728'', ''Retardo mental grave - outros comprometimentos do comportamento''),
(''F729'', ''Retardo mental grave - sem menção de comprometimento do comportamento''),
(''F730'', ''Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F731'', ''Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F738'', ''Retardo mental profundo - outros comprometimentos do comportamento''),
(''F739'', ''Retardo mental profundo - sem menção de comprometimento do comportamento''),
(''F780'', ''Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F781'', ''Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F788'', ''Outro retardo mental - outros comprometimentos do comportamento''),
(''F789'', ''Outro retardo mental - sem menção de comprometimento do comportamento''),
(''F790'', ''Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F791'', ''Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F798'', ''Retardo mental não especificado - outros comprometimentos do comportamento''),
(''F799'', ''Retardo mental não especificado - sem menção de comprometimento do comportamento''),
(''F83'', ''Transtornos específicos misto do desenvolvimento''),
(''F840'', ''Autismo infantil''),
(''F841'', ''Autismo atípico''),
(''F842'', ''Síndrome de Rett''),
(''F843'', ''Outro transtorno desintegrativo da infância''),
(''F844'', ''Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados''),
(''F845'', ''Síndrome de asperger''),
(''F848'', ''Outros transtornos globais do desenvolvimento''),
(''F849'', ''Transtornos globais não especificados do desenvolvimento''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada'')
ON CONFLICT (code) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003509', 'add_cids_to_cid_table_batch_2_including_f819', ARRAY['INSERT INTO cid (code, name) VALUES
(''F700'', ''Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F708'', ''Retardo mental leve - outros comprometimentos do comportamento''),
(''F709'', ''Retardo mental leve - sem menção de comprometimento do comportamento''),
(''F710'', ''Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F711'', ''Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F718'', ''Retardo mental moderado - outros comprometimentos do comportamento''),
(''F719'', ''Retardo mental moderado - sem menção de comprometimento do comportamento''),
(''F720'', ''Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F721'', ''Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F728'', ''Retardo mental grave - outros comprometimentos do comportamento''),
(''F729'', ''Retardo mental grave - sem menção de comprometimento do comportamento''),
(''F730'', ''Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F731'', ''Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F738'', ''Retardo mental profundo - outros comprometimentos do comportamento''),
(''F739'', ''Retardo mental profundo - sem menção de comprometimento do comportamento''),
(''F780'', ''Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F781'', ''Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F788'', ''Outro retardo mental - outros comprometimentos do comportamento''),
(''F789'', ''Outro retardo mental - sem menção de comprometimento do comportamento''),
(''F790'', ''Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F791'', ''Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F798'', ''Retardo mental não especificado - outros comprometimentos do comportamento''),
(''F799'', ''Retardo mental não especificado - sem menção de comprometimento do comportamento''),
(''F819'', ''Transtorno não especificado do desenvolvimento das habilidades escolares''),
(''F83'', ''Transtornos específicos misto do desenvolvimento''),
(''F840'', ''Autismo infantil''),
(''F841'', ''Autismo atípico''),
(''F842'', ''Síndrome de Rett''),
(''F843'', ''Outro transtorno desintegrativo da infância''),
(''F844'', ''Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados''),
(''F845'', ''Síndrome de asperger''),
(''F848'', ''Outros transtornos globais do desenvolvimento''),
(''F849'', ''Transtornos globais não especificados do desenvolvimento''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada'')
ON CONFLICT (code) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003537', 'add_cids_to_cid_table_batch_3_hearing_voice_etc', ARRAY['INSERT INTO cid (code, name) VALUES
(''F900'', ''Distúrbios da atividade e da atenção''),
(''F985'', ''Gagueira [tartamudez]''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada''),
(''H833'', ''Efeitos do ruído sobre o ouvido interno''),
(''H900'', ''Perda de audição bilateral devida a transtorno de condução''),
(''H901'', ''Perda de audição unilateral por transtorno de condução, sem restrição de audição contralateral''),
(''H902'', ''Perda não especificada de audição devida a transtorno de condução''),
(''H903'', ''Perda de audição bilateral neuro-sensorial''),
(''H904'', ''Perda de audição unilateral neuro-sensorial, sem restrição de audição contralateral''),
(''H905'', ''Perda de audição neuro-sensorial não especificada''),
(''H906'', ''Perda de audição bilateral mista, de condução e neuro-sensorial''),
(''H907'', ''Perda de audição unilateral mista, de condução e neuro-sensorial, sem restrição de audição contralateral''),
(''H908'', ''Perda de audição mista, de condução e neuro-sensorial, não especificada''),
(''H910'', ''Perda de audição ototóxica''),
(''H911'', ''Presbiacusia''),
(''H912'', ''Perda de audição súbita idiopática''),
(''H913'', ''Surdo-mudez não classificada em outra parte''),
(''H918'', ''Outras perdas de audição especificadas''),
(''H919'', ''Perda não especificada de audição''),
(''H932'', ''Outras percepções auditivas anormais''),
(''R49'', ''Distúrbios da voz''),
(''R490'', ''Disfonia''),
(''R491'', ''Afonia''),
(''R498'', ''Outros distúrbios da voz e os não especificados'')
ON CONFLICT (code) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003631', 'add_cids_to_cid_table_batch_4_learning_motor_etc', ARRAY['INSERT INTO cid (code, name) VALUES
(''F701'', ''Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F700'', ''Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F708'', ''Retardo mental leve - outros comprometimentos do comportamento''),
(''F709'', ''Retardo mental leve - sem menção de comprometimento do comportamento''),
(''F710'', ''Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F711'', ''Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F718'', ''Retardo mental moderado - outros comprometimentos do comportamento''),
(''F719'', ''Retardo mental moderado - sem menção de comprometimento do comportamento''),
(''F720'', ''Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F721'', ''Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F728'', ''Retardo mental grave - outros comprometimentos do comportamento''),
(''F729'', ''Retardo mental grave - sem menção de comprometimento do comportamento''),
(''F730'', ''Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F731'', ''Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F738'', ''Retardo mental profundo - outros comprometimentos do comportamento''),
(''F739'', ''Retardo mental profundo - sem menção de comprometimento do comportamento''),
(''F780'', ''Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F781'', ''Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F788'', ''Outro retardo mental - outros comprometimentos do comportamento''),
(''F789'', ''Outro retardo mental - sem menção de comprometimento do comportamento''),
(''F790'', ''Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F791'', ''Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F798'', ''Retardo mental não especificado - outros comprometimentos do comportamento''),
(''F799'', ''Retardo mental não especificado - sem menção de comprometimento do comportamento''),
(''F810'', ''Transtorno específico de leitura''),
(''F82'', ''Transtorno específico do desenvolvimento motor''),
(''F83'', ''Transtornos específicos misto do desenvolvimento''),
(''F840'', ''Autismo infantil''),
(''F841'', ''Autismo atípico''),
(''F842'', ''Síndrome de Rett''),
(''F843'', ''Outro transtorno desintegrativo da infância''),
(''F844'', ''Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados''),
(''F845'', ''Síndrome de asperger''),
(''F848'', ''Outros transtornos globais do desenvolvimento''),
(''F849'', ''Transtornos globais não especificados do desenvolvimento''),
(''F88'', ''Outros transtornos do desenvolvimento psicológico''),
(''F89'', ''Transtorno do desenvolvimento psicológico não especificado''),
(''F900'', ''Distúrbios da atividade e da atenção''),
(''F910'', ''Distúrbio de conduta restrito ao contexto familiar''),
(''F920'', ''Distúrbio depressivo de conduta''),
(''F930'', ''Transtorno ligado à angústia de separação''),
(''F940'', ''Mutismo eletivo''),
(''F980'', ''Enurese de origem não-orgânica''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada''),
(''H540'', ''Cegueira, ambos os olhos''),
(''H900'', ''Perda de audição bilateral devida a transtorno de condução''),
(''H910'', ''Perda de audição ototóxica'')
ON CONFLICT (code) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003709', 'add_cids_to_cid_table_duplicate_check_final_batch', ARRAY['INSERT INTO cid (code, name) VALUES
(''F700'', ''Retardo mental leve - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F701'', ''Retardo mental leve - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F708'', ''Retardo mental leve - outros comprometimentos do comportamento''),
(''F709'', ''Retardo mental leve - sem menção de comprometimento do comportamento''),
(''F710'', ''Retardo mental moderado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F711'', ''Retardo mental moderado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F718'', ''Retardo mental moderado - outros comprometimentos do comportamento''),
(''F719'', ''Retardo mental moderado - sem menção de comprometimento do comportamento''),
(''F720'', ''Retardo mental grave - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F721'', ''Retardo mental grave - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F728'', ''Retardo mental grave - outros comprometimentos do comportamento''),
(''F729'', ''Retardo mental grave - sem menção de comprometimento do comportamento''),
(''F730'', ''Retardo mental profundo - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F731'', ''Retardo mental profundo - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F738'', ''Retardo mental profundo - outros comprometimentos do comportamento''),
(''F739'', ''Retardo mental profundo - sem menção de comprometimento do comportamento''),
(''F780'', ''Outro retardo mental - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F781'', ''Outro retardo mental - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F788'', ''Outro retardo mental - outros comprometimentos do comportamento''),
(''F789'', ''Outro retardo mental - sem menção de comprometimento do comportamento''),
(''F790'', ''Retardo mental não especificado - menção de ausência de ou de comprometimento mínimo do comportamento''),
(''F791'', ''Retardo mental não especificado - comprometimento significativo do comportamento, requerendo vigilância ou tratamento''),
(''F798'', ''Retardo mental não especificado - outros comprometimentos do comportamento''),
(''F799'', ''Retardo mental não especificado - sem menção de comprometimento do comportamento''),
(''F83'', ''Transtornos específicos misto do desenvolvimento''),
(''F840'', ''Autismo infantil''),
(''F841'', ''Autismo atípico''),
(''F842'', ''Síndrome de Rett''),
(''F843'', ''Outro transtorno desintegrativo da infância''),
(''F844'', ''Transtorno com hipercinesia associada a retardo mental e a movimentos estereotipados''),
(''F845'', ''Síndrome de asperger''),
(''F848'', ''Outros transtornos globais do desenvolvimento''),
(''F849'', ''Transtornos globais não especificados do desenvolvimento''),
(''G800'', ''Paralisia cerebral quadriplágica espástica''),
(''G801'', ''Paralisia cerebral diplégica espástica''),
(''G802'', ''Paralisia cerebral hemiplégica espástica''),
(''G803'', ''Paralisia cerebral discinética''),
(''G804'', ''Paralisia cerebral atáxica''),
(''G808'', ''Outras formas de paralisia cerebral''),
(''G809'', ''Paralisia cerebral não especificada'')
ON CONFLICT (code) DO NOTHING;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516003918', 'add_missing_service_classifications_datasus', ARRAY['INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''115'', ''002'', ''Atendimento psicossocial (Serviço de Atenção Psicossocial)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''115'' AND classification_code = ''002'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''011'', ''Atenção Fisioterapeutica (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''011'');']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516004014', 'add_more_service_classifications_duplicate_check_2', ARRAY['INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''113'', ''001'', ''Assitência Domiciliar (Serviço de Atenção Domiciliar)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''113'' AND classification_code = ''001'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''113'', ''002'', ''Internação Domiciliar (Serviço de Atenção Domiciliar)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''113'' AND classification_code = ''002'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''001'', ''Reabilitação Visual (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''001'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''002'', ''Reabilitação Intelectual (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''002'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''003'', ''Reabilitação Física (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''003'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''113'', ''003'', ''Equipe Multidisciplinar de Atenção Domiciliar - EMAD (Serviço de Atenção Domiciliar)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''113'' AND classification_code = ''003'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''005'', ''Reabiliatação Auditiva (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''005'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''010'', ''Atenção Fonoaudiológica (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''010'');']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516004129', 'add_service_classifications_135_007_135_008_orthopedic_workshop', ARRAY['INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''007'', ''Oficina Ortopédica Fixa (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''007'');

INSERT INTO service_classifications (service_code, classification_code, name)
SELECT ''135'', ''008'', ''Oficina Ortopédica Intinerante (Serviço de Reabilitação)''
WHERE NOT EXISTS (SELECT 1 FROM service_classifications WHERE service_code = ''135'' AND classification_code = ''008'');']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516013502', 'normalize_document_columns', ARRAY['-- Limpeza de Profissionais
UPDATE public.professionals 
SET 
  cpf = regexp_replace(cpf, ''[^0-9]'', '''', ''g''),
  cns = regexp_replace(cns, ''[^0-9]'', '''', ''g'')
WHERE cpf IS NOT NULL OR cns IS NOT NULL;

-- Limpeza de Pacientes
UPDATE public.patients 
SET 
  cpf = regexp_replace(cpf, ''[^0-9]'', '''', ''g''),
  cns_patient = regexp_replace(cns_patient, ''[^0-9]'', '''', ''g'')
WHERE cpf IS NOT NULL OR cns_patient IS NOT NULL;

-- Limpeza de Clínicas
UPDATE public.clinics 
SET 
  cnpj = regexp_replace(cnpj, ''[^0-9]'', '''', ''g'')
WHERE cnpj IS NOT NULL;

-- Limpeza de Procedimentos
UPDATE public.procedures 
SET 
  code = regexp_replace(code, ''[^0-9]'', '''', ''g'')
WHERE code IS NOT NULL;

-- Limpeza de CID (Mantém letras e números, remove pontos)
UPDATE public.cid 
SET 
  code = regexp_replace(code, ''[^a-zA-Z0-9]'', '''', ''g'')
WHERE code IS NOT NULL;

-- Limpeza de Classificações DATASUS
UPDATE public.service_classifications 
SET 
  service_code = regexp_replace(service_code, ''[^0-9]'', '''', ''g''),
  classification_code = regexp_replace(classification_code, ''[^0-9]'', '''', ''g'')
WHERE service_code IS NOT NULL OR classification_code IS NOT NULL;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516031238', 'add_nao_realizado_status_to_sessions', ARRAY['ALTER TABLE attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;

ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check 
CHECK (status = ANY (ARRAY[''Realizada''::text, ''Pendente''::text, ''Glosado''::text, ''Não Realizado''::text]));']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516033824', 'add_service_classification_to_attendances', ARRAY['ALTER TABLE attendances 
ADD COLUMN service_classification_id UUID REFERENCES service_classifications(id);

COMMENT ON COLUMN attendances.service_classification_id IS ''Referência à classificação DataSUS (Serviço/Classificação)'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125058', 'create_historical_audit_tables', ARRAY['-- 1. Adicionar flag de importação histórica na tabela real de atendimentos
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS is_historical_import BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.attendances.is_historical_import IS ''Marca se o registro foi importado via módulo de auditoria histórica (dados legados Excel).'';

-- 2. Criar tabela de lotes de importação
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  rows_resolved INTEGER DEFAULT 0,
  rows_unmatched INTEGER DEFAULT 0,
  rows_approved INTEGER DEFAULT 0,
  rows_glossed INTEGER DEFAULT 0,
  status TEXT DEFAULT ''uploading''
    CHECK (status IN (''uploading'', ''mapping'', ''matching'', ''validating'', ''completed'', ''cancelled'')),
  imported_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3. Criar tabela de registros históricos (Staging)
CREATE TABLE IF NOT EXISTS public.import_historical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,            -- Linha original na planilha
  
  -- Dados brutos da planilha
  raw_patient_name TEXT,
  raw_patient_cns TEXT,
  raw_professional_name TEXT,
  raw_professional_cns TEXT,
  raw_clinic_name TEXT,
  raw_session_date TEXT, -- Mantido como TEXT para aceitar diversos formatos de data do Excel antes do parsing
  raw_start_time TEXT,
  raw_end_time TEXT,
  raw_procedure_code TEXT,
  raw_procedure_name TEXT,
  raw_cid TEXT,
  raw_auth_number TEXT,
  
  -- IDs resolvidos (NULL se não encontrado)
  resolved_patient_id UUID REFERENCES public.patients(id),
  resolved_professional_id UUID REFERENCES public.professionals(id),
  resolved_clinic_id UUID REFERENCES public.clinics(id),
  resolved_procedure_id UUID REFERENCES public.procedures(id),
  
  -- Status do matching
  match_status TEXT DEFAULT ''pending''
    CHECK (match_status IN (''resolved'', ''partial'', ''unmatched'', ''pending'')),
  match_notes TEXT,                       -- Detalhes do que não bateu
  
  -- Status da validação de regras
  validation_status TEXT DEFAULT ''not_validated''
    CHECK (validation_status IN (''not_validated'', ''approved'', ''glossed'')),
  validation_rules_violated TEXT[],       -- Array: [''BR-001'', ''BR-010'', ...]
  validation_details JSONB,              -- Detalhes: conflito com quem, onde, etc.
  
  -- Status de persistência
  persisted BOOLEAN DEFAULT FALSE,       -- TRUE quando gravado nas tabelas reais
  persisted_attendance_id UUID,
  persisted_session_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar RLS e criar políticas (Apenas SMS_ADMIN)
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_historical_records ENABLE ROW LEVEL SECURITY;

-- Política para import_batches
CREATE POLICY "SMS_ADMIN can do everything on import_batches"
  ON public.import_batches
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = ''SMS_ADMIN''))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = ''SMS_ADMIN''));

-- Política para import_historical_records
CREATE POLICY "SMS_ADMIN can do everything on import_historical_records"
  ON public.import_historical_records
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = ''SMS_ADMIN''))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = ''SMS_ADMIN''));

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_import_historical_records_batch_id ON public.import_historical_records(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_historical_records_match_status ON public.import_historical_records(match_status);
CREATE INDEX IF NOT EXISTS idx_import_historical_records_validation_status ON public.import_historical_records(validation_status);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125403', 'rpc_match_historical_records', ARRAY['CREATE OR REPLACE FUNCTION match_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_matched_patients INTEGER := 0;
    v_matched_professionals INTEGER := 0;
    v_matched_clinics INTEGER := 0;
    v_matched_procedures INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- 1. Matching de Pacientes (Exato por CNS)
    UPDATE import_historical_records i
    SET patient_id = p.id,
        match_status = CASE 
            WHEN i.professional_id IS NOT NULL AND i.clinic_id IS NOT NULL AND i.procedure_id IS NOT NULL THEN ''resolved''::import_match_status
            ELSE i.match_status 
        END
    FROM patients p
    WHERE i.import_batch_id = p_batch_id
      AND i.patient_id IS NULL
      AND i.raw_patient_cns = p.cns;
    
    GET DIAGNOSTICS v_matched_patients = ROW_COUNT;

    -- 2. Matching de Profissionais (Exato por CNS ou CPF)
    UPDATE import_historical_records i
    SET professional_id = p.id
    FROM professionals p
    WHERE i.import_batch_id = p_batch_id
      AND i.professional_id IS NULL
      AND (i.raw_professional_cns = p.cns OR i.raw_professional_cns = p.cpf);
    
    GET DIAGNOSTICS v_matched_professionals = ROW_COUNT;

    -- 3. Matching de Clínicas (Exato por Nome)
    UPDATE import_historical_records i
    SET clinic_id = c.id
    FROM clinics c
    WHERE i.import_batch_id = p_batch_id
      AND i.clinic_id IS NULL
      AND UPPER(i.raw_clinic_name) = UPPER(c.name);
    
    GET DIAGNOSTICS v_matched_clinics = ROW_COUNT;

    -- 4. Matching de Procedimentos (Exato por Código)
    UPDATE import_historical_records i
    SET procedure_id = pr.id
    FROM procedures pr
    WHERE i.import_batch_id = p_batch_id
      AND i.procedure_id IS NULL
      AND i.raw_procedure_code = pr.code;
    
    GET DIAGNOSTICS v_matched_procedures = ROW_COUNT;

    -- Atualizar status global do registro se tudo estiver ok
    UPDATE import_historical_records
    SET match_status = ''resolved''
    WHERE import_batch_id = p_batch_id
      AND patient_id IS NOT NULL
      AND professional_id IS NOT NULL
      AND clinic_id IS NOT NULL
      AND procedure_id IS NOT NULL;

    SELECT count(*) INTO v_total FROM import_historical_records WHERE import_batch_id = p_batch_id;

    RETURN jsonb_build_object(
        ''patients'', v_matched_patients,
        ''professionals'', v_matched_professionals,
        ''clinics'', v_matched_clinics,
        ''procedures'', v_matched_procedures,
        ''total'', v_total
    );
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125455', 'rpc_validate_historical_records', ARRAY['CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_errors JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
    LOOP
        v_errors := ''[]''::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.patient_id AND status != ''Ativo'') THEN
            v_errors := v_errors || jsonb_build_object(''code'', ''BR-001'', ''message'', ''Paciente não está ativo no sistema'');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.professional_id AND status != ''Ativo'') THEN
            v_errors := v_errors || jsonb_build_object(''code'', ''BR-002'', ''message'', ''Profissional não está ativo no sistema'');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.clinic_id AND status != ''Ativo'') THEN
            v_errors := v_errors || jsonb_build_object(''code'', ''BR-003'', ''message'', ''Clínica não está ativa no sistema'');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010) - Sessões Reais
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.patient_id, 
            v_record.professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_errors := v_errors || jsonb_build_object(''code'', ''BR-010'', ''message'', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.professional_id = v_record.professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_errors := v_errors || jsonb_build_object(''code'', ''BR-010-INT'', ''message'', ''Conflito de horário detectado dentro desta planilha para o mesmo profissional'');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_errors = v_errors,
            match_status = CASE WHEN jsonb_array_length(v_errors) > 0 THEN ''pending''::import_match_status ELSE ''resolved''::import_match_status END
        WHERE id = v_record.id;

        IF jsonb_array_length(v_errors) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    -- Atualizar status do batch
    UPDATE import_batches
    SET status = ''validating''
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        ''validated'', v_validated_count,
        ''errors'', v_error_count
    );
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125701', 'fix_historical_audit_rpcs_and_finalize', ARRAY['-- 1. Recriar RPC de Matching com nomes de colunas corretos
CREATE OR REPLACE FUNCTION match_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_matched_patients INTEGER := 0;
    v_matched_professionals INTEGER := 0;
    v_matched_clinics INTEGER := 0;
    v_matched_procedures INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- 1. Matching de Pacientes (Exato por CNS)
    UPDATE import_historical_records i
    SET resolved_patient_id = p.id
    FROM patients p
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_patient_id IS NULL
      AND i.raw_patient_cns = p.cns_patient;
    
    GET DIAGNOSTICS v_matched_patients = ROW_COUNT;

    -- 2. Matching de Profissionais (Exato por CNS ou CPF)
    UPDATE import_historical_records i
    SET resolved_professional_id = p.id
    FROM professionals p
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_professional_id IS NULL
      AND (i.raw_professional_cns = p.cns OR i.raw_professional_cns = p.cpf);
    
    GET DIAGNOSTICS v_matched_professionals = ROW_COUNT;

    -- 3. Matching de Clínicas (Exato por Nome)
    UPDATE import_historical_records i
    SET resolved_clinic_id = c.id
    FROM clinics c
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_clinic_id IS NULL
      AND UPPER(TRIM(i.raw_clinic_name)) = UPPER(TRIM(c.name));
    
    GET DIAGNOSTICS v_matched_clinics = ROW_COUNT;

    -- 4. Matching de Procedimentos (Exato por Código)
    UPDATE import_historical_records i
    SET resolved_procedure_id = pr.id
    FROM procedures pr
    WHERE i.import_batch_id = p_batch_id
      AND i.resolved_procedure_id IS NULL
      AND i.raw_procedure_code = pr.code;
    
    GET DIAGNOSTICS v_matched_procedures = ROW_COUNT;

    -- Atualizar status global do registro se tudo estiver ok
    UPDATE import_historical_records
    SET match_status = ''resolved''
    WHERE import_batch_id = p_batch_id
      AND resolved_patient_id IS NOT NULL
      AND resolved_professional_id IS NOT NULL
      AND resolved_clinic_id IS NOT NULL
      AND resolved_procedure_id IS NOT NULL;

    SELECT count(*) INTO v_total FROM import_historical_records WHERE import_batch_id = p_batch_id;

    RETURN jsonb_build_object(
        ''patients'', v_matched_patients,
        ''professionals'', v_matched_professionals,
        ''clinics'', v_matched_clinics,
        ''procedures'', v_matched_procedures,
        ''total'', v_total
    );
END;
$$;

-- 2. Recriar RPC de Validação com nomes de colunas corretos
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := ''[]''::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-001'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-001'', ''message'', ''Paciente não está ativo no sistema'');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-002'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-002'', ''message'', ''Profissional não está ativo no sistema'');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-003'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-003'', ''message'', ''Clínica não está ativa no sistema'');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010) - Sessões Reais
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010'', ''message'', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010-INT'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010-INT'', ''message'', ''Conflito de horário detectado dentro desta planilha para o mesmo profissional'');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN ''glossed''::import_validation_status ELSE ''approved''::import_validation_status END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        ''validated'', v_validated_count,
        ''errors'', v_error_count
    );
END;
$$;

-- 3. Criar RPC de Finalização
CREATE OR REPLACE FUNCTION finalize_historical_import(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_attendance_id UUID;
    v_imported_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
          AND validation_status = ''approved''
          AND persisted = FALSE
    LOOP
        -- Inserir Header de Attendance
        INSERT INTO public.attendances (
            clinic_id,
            professional_id,
            patient_id,
            procedure_id,
            attendance_date,
            start_time,
            end_time,
            cid,
            auth_number,
            status,
            is_historical_import,
            month_year
        ) VALUES (
            v_record.resolved_clinic_id,
            v_record.resolved_professional_id,
            v_record.resolved_patient_id,
            v_record.resolved_procedure_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            v_record.raw_cid,
            v_record.raw_auth_number,
            ''Realizada'',
            TRUE,
            to_char(v_record.raw_session_date::DATE, ''MM/YYYY'')
        ) RETURNING id INTO v_attendance_id;

        -- Inserir Sessão de Attendance
        INSERT INTO public.attendance_sessions (
            attendance_id,
            session_date,
            start_time,
            end_time,
            status,
            validated_at
        ) VALUES (
            v_attendance_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            ''Realizada'',
            NOW()
        );

        -- Marcar como persistido
        UPDATE import_historical_records
        SET persisted = TRUE,
            persisted_attendance_id = v_attendance_id
        WHERE id = v_record.id;

        v_imported_count := v_imported_count + 1;
    END LOOP;

    -- Finalizar o Batch
    UPDATE import_batches
    SET status = ''completed'',
        completed_at = NOW(),
        rows_approved = v_imported_count
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        ''imported'', v_imported_count
    );
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125816', 'fix_sql_casts_in_historical_audit', ARRAY['-- Corrigindo os casts para usar TEXT já que as colunas são TEXT com CHECK constraints
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := ''[]''::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-001'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-001'', ''message'', ''Paciente não está ativo no sistema'');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-002'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-002'', ''message'', ''Profissional não está ativo no sistema'');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-003'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-003'', ''message'', ''Clínica não está ativa no sistema'');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        v_conflict_msg := check_attendance_session_conflicts(
            NULL, 
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010'', ''message'', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010-INT'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010-INT'', ''message'', ''Conflito de horário detectado dentro desta planilha para o mesmo profissional'');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN ''glossed'' ELSE ''approved'' END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        ''validated'', v_validated_count,
        ''errors'', v_error_count
    );
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516125834', 'fix_check_attendance_conflict_call_historical_audit', ARRAY['-- Corrigindo a chamada da função check_attendance_session_conflicts (faltava um argumento NULL para p_attendance_id)
CREATE OR REPLACE FUNCTION validate_historical_records(p_batch_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := ''[]''::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-001'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-001'', ''message'', ''Paciente não está ativo no sistema'');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-002'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-002'', ''message'', ''Profissional não está ativo no sistema'');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-003'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-003'', ''message'', ''Clínica não está ativa no sistema'');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        -- Argumentos: p_session_id, p_attendance_id, p_patient_id, p_professional_id, p_date, p_start, p_end
        v_conflict_msg := public.check_attendance_session_conflicts(
            NULL, 
            NULL,
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010'', ''message'', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010-INT'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010-INT'', ''message'', ''Conflito de horário detectado dentro desta planilha para o mesmo profissional'');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN ''glossed'' ELSE ''approved'' END
        WHERE id = v_record.id;

        IF array_length(v_rules_violated, 1) > 0 THEN
            v_error_count := v_error_count + 1;
        ELSE
            v_validated_count := v_validated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        ''validated'', v_validated_count,
        ''errors'', v_error_count
    );
END;
$$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516133549', 'add_clinical_fields_to_historical_records', ARRAY['ALTER TABLE public.import_historical_records 
ADD COLUMN cid text,
ADD COLUMN service_classification_id uuid REFERENCES public.service_classifications(id),
ADD COLUMN attendance_character text DEFAULT ''01'';

COMMENT ON COLUMN public.import_historical_records.cid IS ''Resolved CID for historical import'';
COMMENT ON COLUMN public.import_historical_records.service_classification_id IS ''Resolved DataSUS service classification'';
COMMENT ON COLUMN public.import_historical_records.attendance_character IS ''Resolved attendance character (01=Eletivo, etc)'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516133604', 'add_resolved_metadata_to_historical_records_v2', ARRAY['ALTER TABLE public.import_historical_records 
ADD COLUMN resolved_session_date date,
ADD COLUMN resolved_start_time time without time zone,
ADD COLUMN resolved_end_time time without time zone,
ADD COLUMN resolved_auth_number text,
ADD COLUMN resolved_quantity integer DEFAULT 1;

COMMENT ON COLUMN public.import_historical_records.resolved_session_date IS ''Manually corrected session date'';
COMMENT ON COLUMN public.import_historical_records.resolved_quantity IS ''Manually corrected quantity for BPA'';']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516140143', 'reporting_module_functions', ARRAY['
-- 1. Relatório Detalhado de Faturamento (BPA Ready)
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.co_procedimento as procedure_code,
      proc.no_procedimento as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Relatório de Desempenho e Produtividade
CREATE OR REPLACE FUNCTION get_performance_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(stats) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      prof.name as professional_name,
      COUNT(s.id) FILTER (WHERE s.status = ''Realizada'') as completed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Não Realizado'') as missed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Pendente'') as pending_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Glosado'') as denied_sessions,
      SUM(proc.valor_total) FILTER (WHERE s.status = ''Realizada'') as total_value,
      ROUND((COUNT(s.id) FILTER (WHERE s.status = ''Não Realizado'')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100), 2) as absenteeism_rate
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, prof.name
    ORDER BY total_value DESC NULLS LAST
  ) stats;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Relatório de Inconsistências (Audit)
CREATE OR REPLACE FUNCTION get_consistency_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(issues) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      prof.name as professional_name,
      proc.no_procedimento as procedure_name,
      s.session_date,
      CASE 
        WHEN a.professional_cbo IS NULL OR a.professional_cbo = '''' THEN ''CBO Ausente''
        WHEN p.cns IS NULL OR p.cns = '''' THEN ''CNS do Paciente Ausente''
        WHEN prof.cns IS NULL OR prof.cns = '''' THEN ''CNS do Profissional Ausente''
        WHEN a.cid IS NULL OR a.cid = '''' THEN ''CID Ausente''
        WHEN s.status = ''Realizada'' AND (s.validated_at IS NULL) THEN ''Sessão Realizada sem Assinatura Digital''
        ELSE ''Inconsistência de Metadados''
      END as issue_type
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (
        a.professional_cbo IS NULL OR a.professional_cbo = '''' OR
        p.cns IS NULL OR p.cns = '''' OR
        prof.cns IS NULL OR prof.cns = '''' OR
        a.cid IS NULL OR a.cid = '''' OR
        (s.status = ''Realizada'' AND s.validated_at IS NULL)
      )
    ORDER BY s.session_date DESC
  ) issues;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516142929', 'reporting_mode_support', ARRAY['
-- 1. Atualização do Relatório de Faturamento para suportar Modos
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT ''official''
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.co_procedimento as procedure_code,
      proc.no_procedimento as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (
        CASE 
          WHEN p_mode = ''official'' THEN s.status = ''Realizada''
          WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
          ELSE TRUE -- ''all'' mode
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516144752', 'reporting_filters_fix', ARRAY['
-- Atualização da função de faturamento para incluir filtro de procedimento e tratamento de nulos
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_procedure_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT ''official''
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = ''official'' THEN s.status = ''Realizada''
          WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516145211', 'reporting_pagination', ARRAY['
-- Atualização da função de faturamento com paginação
CREATE OR REPLACE FUNCTION get_billing_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_procedure_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT ''official'',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
    AND (
      CASE 
        WHEN p_mode = ''official'' THEN s.status = ''Realizada''
        WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
        ELSE TRUE 
      END
    );

  -- Busca dos dados com limite/offset
  SELECT json_agg(rows) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      proc.valor_total as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = ''official'' THEN s.status = ''Realizada''
          WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
    LIMIT p_limit
    OFFSET p_offset
  ) rows;

  RETURN json_build_object(
    ''data'', COALESCE(v_data, ''[]''::json),
    ''total'', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516145234', 'reporting_pagination_all', ARRAY['
-- Atualização da função de performance com paginação
CREATE OR REPLACE FUNCTION get_performance_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Total de grupos (linhas no relatório)
  SELECT count(*) INTO v_total
  FROM (
    SELECT c.id, prof.id
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.id, prof.id
  ) groups;

  SELECT json_agg(stats) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      prof.name as professional_name,
      COUNT(s.id) FILTER (WHERE s.status = ''Realizada'') as completed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Não Realizado'') as missed_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Pendente'') as pending_sessions,
      COUNT(s.id) FILTER (WHERE s.status = ''Glosado'') as denied_sessions,
      SUM(proc.valor_total) FILTER (WHERE s.status = ''Realizada'') as total_value,
      ROUND((COUNT(s.id) FILTER (WHERE s.status = ''Não Realizado'')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100), 2) as absenteeism_rate
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    GROUP BY c.name, prof.name
    ORDER BY total_value DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  ) stats;

  RETURN json_build_object(
    ''data'', COALESCE(v_data, ''[]''::json),
    ''total'', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualização da função de consistência com paginação
CREATE OR REPLACE FUNCTION get_consistency_report(
  p_start_date DATE,
  p_end_date DATE,
  p_clinic_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  JOIN patients p ON a.patient_id = p.id
  JOIN professionals prof ON a.professional_id = prof.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (
      a.professional_cbo IS NULL OR a.professional_cbo = '''' OR
      p.cns_patient IS NULL OR p.cns_patient = '''' OR
      prof.cns IS NULL OR prof.cns = '''' OR
      a.cid IS NULL OR a.cid = '''' OR
      (s.status = ''Realizada'' AND s.validated_at IS NULL)
    );

  SELECT json_agg(issues) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      prof.name as professional_name,
      proc.name as procedure_name,
      s.session_date,
      CASE 
        WHEN a.professional_cbo IS NULL OR a.professional_cbo = '''' THEN ''CBO Ausente''
        WHEN p.cns_patient IS NULL OR p.cns_patient = '''' THEN ''CNS do Paciente Ausente''
        WHEN prof.cns IS NULL OR prof.cns = '''' THEN ''CNS do Profissional Ausente''
        WHEN a.cid IS NULL OR a.cid = '''' THEN ''CID Ausente''
        WHEN s.status = ''Realizada'' AND (s.validated_at IS NULL) THEN ''Sessão Realizada sem Assinatura Digital''
        ELSE ''Inconsistência de Metadados''
      END as issue_type
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
    JOIN procedures proc ON a.procedure_id = proc.id
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (
        a.professional_cbo IS NULL OR a.professional_cbo = '''' OR
        p.cns_patient IS NULL OR p.cns_patient = '''' OR
        prof.cns IS NULL OR prof.cns = '''' OR
        a.cid IS NULL OR a.cid = '''' OR
        (s.status = ''Realizada'' AND s.validated_at IS NULL)
      )
    ORDER BY s.session_date DESC
    LIMIT p_limit
    OFFSET p_offset
  ) issues;

  RETURN json_build_object(
    ''data'', COALESCE(v_data, ''[]''::json),
    ''total'', COALESCE(v_total, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516152325', 'create_report_requests_table_v2', ARRAY['-- Create report_requests table for secure printing
CREATE TABLE IF NOT EXISTS public.report_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filters JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval ''10 minutes'')
);

-- Enable RLS
ALTER TABLE public.report_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own report requests
CREATE POLICY "Users can only read their own report requests"
    ON public.report_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own report requests
CREATE POLICY "Users can only insert their own report requests"
    ON public.report_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Add index on expires_at for cleanup
CREATE INDEX idx_report_requests_expires_at ON public.report_requests(expires_at);
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260516223216', 'add_audit_fields_to_attendance_sessions', ARRAY['ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS action_by_login text;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS validation_type text;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260517143140', 'add_active_to_professional_clinics', ARRAY['ALTER TABLE public.professional_clinics ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260517155057', 'add_target_competence_to_historical_import', ARRAY['-- Migration para suporte a competências retroativas na importação histórica
ALTER TABLE public.import_batches 
ADD COLUMN IF NOT EXISTS target_competence VARCHAR(7);

CREATE OR REPLACE FUNCTION public.finalize_historical_import(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_record RECORD;
    v_attendance_id UUID;
    v_imported_count INTEGER := 0;
    v_target_competence VARCHAR(7);
BEGIN
    -- Busca a competência definida no lote
    SELECT target_competence INTO v_target_competence 
    FROM import_batches 
    WHERE id = p_batch_id;

    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
          AND validation_status = ''approved''
          AND persisted = FALSE
    LOOP
        -- Inserir Header de Attendance
        INSERT INTO public.attendances (
            clinic_id,
            professional_id,
            patient_id,
            procedure_id,
            attendance_date,
            start_time,
            end_time,
            cid,
            auth_number,
            status,
            is_historical_import,
            month_year
        ) VALUES (
            v_record.resolved_clinic_id,
            v_record.resolved_professional_id,
            v_record.resolved_patient_id,
            v_record.resolved_procedure_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            v_record.raw_cid,
            v_record.raw_auth_number,
            ''Realizada'',
            TRUE,
            -- Se o lote tiver competência definida, usa ela. Caso contrário, gera da data do atendimento.
            COALESCE(v_target_competence, to_char(v_record.raw_session_date::DATE, ''MM/YYYY''))
        ) RETURNING id INTO v_attendance_id;

        -- Inserir Sessão de Attendance
        INSERT INTO public.attendance_sessions (
            attendance_id,
            session_date,
            start_time,
            end_time,
            status,
            validated_at
        ) VALUES (
            v_attendance_id,
            v_record.raw_session_date::DATE,
            v_record.raw_start_time::TIME,
            v_record.raw_end_time::TIME,
            ''Realizada'',
            NOW()
        );

        -- Marcar como persistido
        UPDATE import_historical_records
        SET persisted = TRUE,
            persisted_attendance_id = v_attendance_id
        WHERE id = v_record.id;

        v_imported_count := v_imported_count + 1;
    END LOOP;

    -- Finalizar o Batch
    UPDATE import_batches
    SET status = ''completed'',
        completed_at = NOW(),
        rows_approved = v_imported_count
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        ''imported'', v_imported_count
    );
END;
$function$;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260517162427', 'add_is_historical_to_competences', ARRAY['ALTER TABLE public.competences ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260517162610', 'update_validate_historical_records_arbitration', ARRAY['CREATE OR REPLACE FUNCTION public.validate_historical_records(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_record RECORD;
    v_rules_violated TEXT[];
    v_details JSONB;
    v_conflict_msg TEXT;
    v_validated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM import_historical_records 
        WHERE import_batch_id = p_batch_id 
          AND match_status = ''resolved''
          AND (match_notes IS NULL OR match_notes NOT LIKE ''Aprovação de Arbitragem%'')
    LOOP
        v_rules_violated := ARRAY[]::TEXT[];
        v_details := ''[]''::JSONB;

        -- 1. Validar Status do Paciente (BR-001)
        IF EXISTS (SELECT 1 FROM patients WHERE id = v_record.resolved_patient_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-001'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-001'', ''message'', ''Paciente não está ativo no sistema'');
        END IF;

        -- 2. Validar Status do Profissional (BR-002)
        IF EXISTS (SELECT 1 FROM professionals WHERE id = v_record.resolved_professional_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-002'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-002'', ''message'', ''Profissional não está ativo no sistema'');
        END IF;

        -- 3. Validar Status da Clínica (BR-003)
        IF EXISTS (SELECT 1 FROM clinics WHERE id = v_record.resolved_clinic_id AND active IS FALSE) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-003'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-003'', ''message'', ''Clínica não está ativa no sistema'');
        END IF;

        -- 4. Validar Conflitos de Horário (BR-010)
        v_conflict_msg := public.check_attendance_session_conflicts(
            NULL, 
            NULL,
            v_record.resolved_patient_id, 
            v_record.resolved_professional_id, 
            v_record.raw_session_date::DATE, 
            v_record.raw_start_time::TIME, 
            v_record.raw_end_time::TIME
        );

        IF v_conflict_msg IS NOT NULL THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010'', ''message'', v_conflict_msg);
        END IF;

        -- 5. Validar Conflitos de Horário (BR-010) - Dentro do Lote
        IF EXISTS (
            SELECT 1 FROM import_historical_records i2
            WHERE i2.import_batch_id = p_batch_id
              AND i2.id != v_record.id
              AND i2.resolved_professional_id = v_record.resolved_professional_id
              AND i2.raw_session_date = v_record.raw_session_date
              AND (i2.raw_start_time::TIME, i2.raw_end_time::TIME) OVERLAPS (v_record.raw_start_time::TIME, v_record.raw_end_time::TIME)
        ) THEN
            v_rules_violated := array_append(v_rules_violated, ''BR-010-INT'');
            v_details := v_details || jsonb_build_object(''code'', ''BR-010-INT'', ''message'', ''Conflito de horário detectado dentro desta planilha para o mesmo profissional'');
        END IF;

        -- Atualizar Registro
        UPDATE import_historical_records
        SET validation_rules_violated = v_rules_violated,
            validation_details = v_details,
            validation_status = CASE WHEN array_length(v_rules_violated, 1) > 0 THEN ''glossed'' ELSE ''approved'' END
        WHERE id = v_record.id;

    END LOOP;

    -- Recalcular estatísticas reais incluindo arbitrados
    SELECT 
        count(*) FILTER (WHERE validation_status = ''approved''),
        count(*) FILTER (WHERE validation_status = ''glossed'')
    INTO v_validated_count, v_error_count
    FROM import_historical_records
    WHERE import_batch_id = p_batch_id
      AND match_status = ''resolved'';

    RETURN jsonb_build_object(
        ''validated'', COALESCE(v_validated_count, 0),
        ''errors'', COALESCE(v_error_count, 0)
    );
END;
$function$;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260519024305', 'add_contracts_table_and_balances', ARRAY['-- ==========================================
-- FASE 1: CRIAÇÃO DA TABELA DE CONTRATOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL,
    CONSTRAINT unique_clinic_contract UNIQUE (clinic_id, contract_number)
);

-- Habilitar RLS Rígido (Padrão de Segurança SisTEA)
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Excluir políticas se já existirem (Garantir idempotência)
DROP POLICY IF EXISTS "Admin full access contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users view own contracts" ON public.contracts;

-- Criar as Políticas de Segurança
CREATE POLICY "Admin full access contracts" 
ON public.contracts FOR ALL USING (public.get_user_role() = ''SMS_ADMIN'');

CREATE POLICY "Users view own contracts" 
ON public.contracts FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- ==========================================
-- FASE 2: ADAPTAÇÃO DOS PREÇOS (ITENS DO CONTRATO)
-- ==========================================
ALTER TABLE public.clinic_procedure_prices
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quantidade_contratada INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantidade_saldo INTEGER NOT NULL DEFAULT 0;

-- ==========================================
-- FASE 3: MIGRAR DADOS HISTÓRICOS AUTOMATICAMENTE
-- ==========================================
DO $$
DECLARE
    rec RECORD;
    v_contract_id UUID;
    v_valid_from DATE;
    v_valid_to DATE;
BEGIN
    FOR rec IN 
        SELECT DISTINCT clinic_id, contract_number 
        FROM public.clinic_procedure_prices 
        WHERE contract_number IS NOT NULL AND contract_number <> ''''
    LOOP
        -- Se já existir um contrato para esta clínica e número, não duplicamos
        SELECT id INTO v_contract_id
        FROM public.contracts
        WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number;

        IF v_contract_id IS NULL THEN
            -- Identificar os extremos de validade dos procedimentos vinculados
            SELECT MIN(valid_from), MAX(valid_to)
            INTO v_valid_from, v_valid_to
            FROM public.clinic_procedure_prices
            WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number;

            -- Inserir o contrato pai
            INSERT INTO public.contracts (clinic_id, contract_number, valid_from, valid_to, valor_total, valor_saldo, active)
            VALUES (
                rec.clinic_id, 
                rec.contract_number, 
                COALESCE(v_valid_from, CURRENT_DATE), 
                v_valid_to, 
                0.00,
                0.00,
                true
            )
            RETURNING id INTO v_contract_id;
        END IF;

        -- Associar os itens de precificação ao contrato correspondente
        UPDATE public.clinic_procedure_prices
        SET contract_id = v_contract_id
        WHERE clinic_id = rec.clinic_id AND contract_number = rec.contract_number AND contract_id IS NULL;
    END LOOP;
END $$;

-- ==========================================
-- FASE 4: OTIMIZAÇÃO E PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_attendances_contract_validation 
ON public.attendances (clinic_id, procedure_id, status, attendance_date);']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260519024345', 'add_contract_concurrency_functions', ARRAY['-- =========================================================================
-- FUNÇÃO DE DEDUÇÃO DE BALANÇOS COM LOCKING PESSIMISTA (PREVENÇÃO DE RACE CONDITIONS)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deduct_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    v_item RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id, valor_saldo, valor_total INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION ''Contrato não encontrado.'';
    END IF;

    -- 2. Validar teto financeiro
    IF p_total_value > v_current_contract.valor_saldo THEN
        RAISE EXCEPTION ''Estouro de saldo financeiro do contrato.'';
    END IF;

    -- 3. Deduzir do saldo do contrato
    UPDATE public.contracts
    SET valor_saldo = valor_saldo - p_total_value
    WHERE id = p_contract_id;

    -- 4. Validar e deduzir tetos físicos
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            -- Bloqueia a linha do procedimento para escrita concorrente
            SELECT id, quantidade_saldo INTO v_item
            FROM public.clinic_procedure_prices
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i]
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION ''Procedimento não pactuado no contrato.'';
            END IF;

            IF p_procedure_counts[i] > v_item.quantidade_saldo THEN
                RAISE EXCEPTION ''Estouro de saldo de quantidade para o procedimento.'';
            END IF;

            -- Deduzir do saldo físico
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
            WHERE id = v_item.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- FUNÇÃO DE REESTORNO DE BALANÇOS (CASO A COMPETÊNCIA SEJA REABERTA)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.refund_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF FOUND THEN
        -- Reestornar valor financeiro
        UPDATE public.contracts
        SET valor_saldo = valor_saldo + p_total_value
        WHERE id = p_contract_id;
    END IF;

    -- 2. Reestornar quantidades físicas
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo + p_procedure_counts[i]
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i];
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260519041845', 'add_funding_split_to_billing_report', ARRAY['-- =========================================================================
-- MIGRATION: Adiciona desmembramento de recursos (SUS vs RP) no Relatório de Faturamento
-- =========================================================================

-- 1. Atualizar overload com paginação (9 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT ''official''::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_data JSON;
  v_total INTEGER;
BEGIN
  -- Contagem total sem limite/offset
  SELECT count(*) INTO v_total
  FROM attendance_sessions s
  JOIN attendances a ON s.attendance_id = a.id
  WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
    AND (p_end_date IS NULL OR s.session_date <= p_end_date)
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
    AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
    AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
    AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
    AND (
      CASE 
        WHEN p_mode = ''official'' THEN s.status = ''Realizada''
        WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
        ELSE TRUE 
      END
    );

  -- Busca dos dados com limite/offset e cálculo de desmembramento SUS e Recurso Próprio (RP)
  SELECT json_agg(rows) INTO v_data
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      COALESCE(cpp.valor_sus, proc.valor_sus) as valor_sus,
      COALESCE(cpp.valor_rp, proc.valor_rp) as valor_rp,
      COALESCE(cpp.valor_total, proc.valor_total) as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = ''official'' THEN s.status = ''Realizada''
          WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
    LIMIT p_limit
    OFFSET p_offset
  ) rows;

  RETURN json_build_object(
    ''data'', COALESCE(v_data, ''[]''::json),
    ''total'', COALESCE(v_total, 0)
  );
END;
$function$;


-- 2. Atualizar overload sem paginação (7 argumentos)
CREATE OR REPLACE FUNCTION public.get_billing_report(
  p_start_date date,
  p_end_date date,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_procedure_id uuid DEFAULT NULL::uuid,
  p_mode text DEFAULT ''official''::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(rows) INTO v_result
  FROM (
    SELECT 
      c.name as clinic_name,
      p.name as patient_name,
      p.cns_patient as patient_cns,
      prof.name as professional_name,
      prof.cns as professional_cns,
      a.professional_cbo,
      proc.code as procedure_code,
      proc.name as procedure_name,
      s.session_date,
      s.status,
      a.auth_number,
      COALESCE(cpp.valor_sus, proc.valor_sus) as valor_sus,
      COALESCE(cpp.valor_rp, proc.valor_rp) as valor_rp,
      COALESCE(cpp.valor_total, proc.valor_total) as value
    FROM attendance_sessions s
    JOIN attendances a ON s.attendance_id = a.id
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    JOIN professionals prof ON a.professional_id = prof.id
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
    WHERE (p_start_date IS NULL OR s.session_date >= p_start_date)
      AND (p_end_date IS NULL OR s.session_date <= p_end_date)
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
      AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
      AND (p_procedure_id IS NULL OR a.procedure_id = p_procedure_id)
      AND (
        CASE 
          WHEN p_mode = ''official'' THEN s.status = ''Realizada''
          WHEN p_mode = ''preview'' THEN s.status IN (''Realizada'', ''Pendente'')
          ELSE TRUE 
        END
      )
    ORDER BY s.session_date DESC, c.name, p.name
  ) rows;

  RETURN COALESCE(v_result, ''[]''::json);
END;
$function$;
']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260519043558', 'create_view_competence_billing_sums', ARRAY['CREATE OR REPLACE VIEW public.view_competence_billing_sums AS
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
WHERE s.status = ''Realizada''
GROUP BY a.clinic_id, a.month_year;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);
INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback) VALUES ('20260519211226', 'allow_negative_procedure_balances', ARRAY['-- =========================================================================
-- FUNÇÃO DE DEDUÇÃO DE BALANÇOS COM LOCKING PESSIMISTA (PERMITE QUANTIDADE NEGATIVA)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.deduct_contract_balances(
    p_contract_id UUID,
    p_total_value NUMERIC,
    p_procedure_ids UUID[],
    p_procedure_counts INT[]
) RETURNS VOID AS $$
DECLARE
    v_current_contract RECORD;
    v_item RECORD;
    i INT;
BEGIN
    -- 1. Bloqueia a linha do contrato para escrita concorrente
    SELECT id, valor_saldo, valor_total INTO v_current_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION ''Contrato não encontrado.'';
    END IF;

    -- 2. Validar teto financeiro (Hard Lock)
    IF p_total_value > v_current_contract.valor_saldo THEN
        RAISE EXCEPTION ''Estouro de saldo financeiro do contrato.'';
    END IF;

    -- 3. Deduzir do saldo do contrato
    UPDATE public.contracts
    SET valor_saldo = valor_saldo - p_total_value
    WHERE id = p_contract_id;

    -- 4. Deduzir do saldo físico (permitindo saldo negativo)
    IF p_procedure_ids IS NOT NULL THEN
        FOR i IN 1..cardinality(p_procedure_ids) LOOP
            -- Bloqueia a linha do procedimento para escrita concorrente
            SELECT id, quantidade_saldo INTO v_item
            FROM public.clinic_procedure_prices
            WHERE contract_id = p_contract_id AND procedure_id = p_procedure_ids[i]
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION ''Procedimento não pactuado no contrato.'';
            END IF;

            -- Deduzir do saldo físico diretamente (sem bloquear se ultrapassar)
            UPDATE public.clinic_procedure_prices
            SET quantidade_saldo = quantidade_saldo - p_procedure_counts[i]
            WHERE id = v_item.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;']::text[], 'fernandomarculino@gmail.com', NULL, NULL);

-- 5. Insert Auth Users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('208ef83f-a5cd-4fff-97b9-bd7c2c8cebed', '00000000-0000-0000-0000-000000000000', 'comunicare@comunicare.com.br', '$2a$10$8fq4K504kdkIuVl6ftamCeQgD0yWOCxQTSfeS7oejbt7WWk4F1hFy', '2026-03-13T20:40:11.058415+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-03-13T20:40:11.047058+00:00', '2026-05-20T14:56:34.448463+00:00', 'authenticated', 'authenticated', NULL, '', '', '', '', '', '', '', '');
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('5b54e1ed-57ea-43f3-a2a3-6a35a706bb95', '00000000-0000-0000-0000-000000000000', 'fernandomarculino@gmail.com', '$2a$10$pY.ZhTfpbGlW2fCbPHPgfe.GYSVnq5x0Kdo1msdjJhecIKA84ZcSS', '2026-03-13T02:38:49.165518+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-03-13T02:38:49.159249+00:00', '2026-05-21T23:05:56.775573+00:00', 'authenticated', 'authenticated', NULL, '', '', '', '', '', '', '', '');
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('83ade187-c38d-47c3-9204-2871bd2d5b26', '00000000-0000-0000-0000-000000000000', 'admin@sistea.mg', '$2a$10$gxohp.UjkqhQDFI.Z2gsAuIhlZOnnSrSUEiMItSZ7.y3TJQSZzKhq', '2026-03-13T00:08:40.500072+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '2026-03-13T00:08:40.500072+00:00', '2026-05-19T04:36:42.559825+00:00', 'authenticated', 'authenticated', false, '', '', '', '', '', '', '', '');
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('e20eb596-46f6-4a45-a75a-2b4feae45f25', '00000000-0000-0000-0000-000000000000', 'geizansilva22@hotmail.com', '$2a$10$0H52BiG3rDI87mX91JtqsOaalZJsb4n46Mp56t4WasDUmIrp.Et46', '2026-03-13T13:26:35.869195+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-03-13T13:26:35.824285+00:00', '2026-03-13T17:45:29.461344+00:00', 'authenticated', 'authenticated', NULL, '', '', '', '', '', '', '', '');
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('a8cdbb0c-ab8d-4528-a4e2-26da70a524d3', '00000000-0000-0000-0000-000000000000', 'nayanerebelo.enf@gmail.com', '$2a$10$PBVDKzpaGj7YJ6TAA3XNAuze8F5kBGJC91b14YlrCWkNVEv.FjWSu', '2026-03-20T14:53:51.453748+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-03-20T14:53:51.434381+00:00', '2026-05-04T11:37:28.657924+00:00', 'authenticated', 'authenticated', NULL, '', '', '', '', '', '', '', '');
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token, phone_change, phone_change_token, email_change_token_current, reauthentication_token) VALUES ('932dc589-ab29-4905-9d2b-20d43be4c188', '00000000-0000-0000-0000-000000000000', 'infanty@infanty.com.br', '$2a$10$FIELStsgMgv8tGcFVNqrn.W8I7klFmFQY2BvsIOs.dbW2tylU0rry', '2026-03-13T20:40:49.924095+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb, '2026-03-13T20:40:49.872708+00:00', '2026-05-17T01:20:15.672497+00:00', 'authenticated', 'authenticated', NULL, '', '', '', '', '', '', '', '');

-- 6. Insert Auth Identities
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('3b114e1e-8ecd-455d-bc28-55b7e458a48c', 'e20eb596-46f6-4a45-a75a-2b4feae45f25', 'e20eb596-46f6-4a45-a75a-2b4feae45f25', '{"sub":"e20eb596-46f6-4a45-a75a-2b4feae45f25","email":"geizansilva22@hotmail.com","email_verified":false,"phone_verified":false}'::jsonb, 'email', '2026-03-13T13:26:35.861366+00:00', '2026-03-13T13:26:35.861423+00:00', '2026-03-13T13:26:35.861423+00:00');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('e32740ab-8a45-4b03-90e7-22cc197b9d2b', '5b54e1ed-57ea-43f3-a2a3-6a35a706bb95', '5b54e1ed-57ea-43f3-a2a3-6a35a706bb95', '{"sub":"5b54e1ed-57ea-43f3-a2a3-6a35a706bb95","email":"fernandomarculino@gmail.com","email_verified":false,"phone_verified":false}'::jsonb, 'email', '2026-03-13T02:38:49.162686+00:00', '2026-03-13T02:38:49.162738+00:00', '2026-03-13T02:38:49.162738+00:00');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('c602a40f-6724-4363-8041-2fa79d2947bc', 'a8cdbb0c-ab8d-4528-a4e2-26da70a524d3', 'a8cdbb0c-ab8d-4528-a4e2-26da70a524d3', '{"sub":"a8cdbb0c-ab8d-4528-a4e2-26da70a524d3","email":"nayanerebelo.enf@gmail.com","email_verified":false,"phone_verified":false}'::jsonb, 'email', '2026-03-20T14:53:51.446333+00:00', '2026-03-20T14:53:51.44639+00:00', '2026-03-20T14:53:51.44639+00:00');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('c919486c-bc85-4534-bd20-46eb36855703', '932dc589-ab29-4905-9d2b-20d43be4c188', '932dc589-ab29-4905-9d2b-20d43be4c188', '{"sub":"932dc589-ab29-4905-9d2b-20d43be4c188","email":"infanty@infanty.com.br","email_verified":false,"phone_verified":false}'::jsonb, 'email', '2026-03-13T20:40:49.90397+00:00', '2026-03-13T20:40:49.904022+00:00', '2026-03-13T20:40:49.904022+00:00');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('4b625b1a-4bc3-4cbe-b4d9-b11bf3984766', '208ef83f-a5cd-4fff-97b9-bd7c2c8cebed', '208ef83f-a5cd-4fff-97b9-bd7c2c8cebed', '{"sub":"208ef83f-a5cd-4fff-97b9-bd7c2c8cebed","email":"comunicare@comunicare.com.br","email_verified":false,"phone_verified":false}'::jsonb, 'email', '2026-03-13T20:40:11.053009+00:00', '2026-03-13T20:40:11.05306+00:00', '2026-03-13T20:40:11.05306+00:00');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ('2b9a3e03-85cf-412b-869a-0311facf2089', '83ade187-c38d-47c3-9204-2871bd2d5b26', '83ade187-c38d-47c3-9204-2871bd2d5b26', '{"sub":"83ade187-c38d-47c3-9204-2871bd2d5b26","email":"admin@sistea.mg","email_verified":false}'::jsonb, 'email', '2026-03-13T00:08:40.500072+00:00', '2026-03-13T00:08:40.500072+00:00', '2026-03-13T00:08:40.500072+00:00');

RESET session_replication_role;
-- End of Part 1