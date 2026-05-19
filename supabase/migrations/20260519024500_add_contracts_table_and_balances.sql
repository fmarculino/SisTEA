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
