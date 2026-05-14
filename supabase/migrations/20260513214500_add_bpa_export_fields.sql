-- Fase 1: Adição de campos para Exportação BPA (Zero Downtime)

-- 1. Clínicas
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS orgao_emissor TEXT;

-- 2. Pacientes
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS ibge_code TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT '010',
ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- 3. Procedimentos
ALTER TABLE public.procedures 
ADD COLUMN IF NOT EXISTS bpa_type TEXT DEFAULT 'NAO_APLICA' CHECK (bpa_type IN ('BPA_I', 'BPA_C', 'AMBOS', 'NAO_APLICA'));

-- 4. Atendimentos
ALTER TABLE public.attendances 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS attendance_character TEXT DEFAULT '01';

-- 5. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_attendances_export 
ON public.attendances (clinic_id, month_year, status);
