-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Clínicas
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    cnes TEXT,
    corporate_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
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
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    cns_patient TEXT NOT NULL UNIQUE,
    mother_name TEXT,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL DEFAULT 'Não Informado',
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    cep TEXT,
    race_color TEXT DEFAULT 'Não Informado',
    medical_record_number TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Procedimentos
CREATE TABLE public.procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    valor_sus NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_rp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(10, 2) GENERATED ALWAYS AS (valor_sus + valor_rp) STORED,
    active BOOLEAN DEFAULT true,
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


--=========================================
-- SEED INITIAL DATA (USUÁRIO MASTER)
--=========================================
-- A criação do hash de senha bcrypt e ID depende do Supabase Auth. 
-- Instruções:
-- 1. Rode este script no painel SQL do Supabase.
-- 2. Na aba Authentication > Users, crie um novo usuário "master@sms.mg".
-- 3. Em seguida, pegue o UUID gerado, e insira na tabela users publicamente:
-- INSERT INTO public.users (id, email, role, clinic_id) VALUES ('<COLOQUE_UUID_AQUI>', 'master@sms.mg', 'SMS_ADMIN', null);
