-- =========================================================================
-- MIGRATION: Suporte a Compartilhamento de Contratos (Matriz e Filiais)
-- 
-- Permite que uma clínica Matriz e suas Filiais compartilhem o mesmo contrato
-- ou possuam contratos independentes.
-- =========================================================================

-- =============================================
-- FASE 1: TABELA contract_clinics (Vínculo N:N)
-- =============================================

CREATE TABLE IF NOT EXISTS public.contract_clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_contract_clinic UNIQUE (contract_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_clinics_contract ON public.contract_clinics(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_clinics_clinic ON public.contract_clinics(clinic_id);

-- RLS para contract_clinics
ALTER TABLE public.contract_clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access contract_clinics" ON public.contract_clinics;
CREATE POLICY "Admin full access contract_clinics" 
ON public.contract_clinics FOR ALL 
USING (public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR'));

DROP POLICY IF EXISTS "Users view group contract_clinics" ON public.contract_clinics;
CREATE POLICY "Users view group contract_clinics" 
ON public.contract_clinics FOR SELECT 
USING (public.user_can_access_clinic(clinic_id));

-- =============================================
-- FASE 2: POPULAR CONTRATOS EXISTENTES
-- =============================================

-- Inserir a própria clinic_id de cada contrato existente como vínculo padrão
INSERT INTO public.contract_clinics (contract_id, clinic_id)
SELECT id, clinic_id
FROM public.contracts
ON CONFLICT (contract_id, clinic_id) DO NOTHING;

-- Para matrizes que já possuem filiais e cujas filiais não possuem contrato próprio,
-- vincular automaticamente a filial ao contrato da matriz (retrocompatibilidade imediata)
INSERT INTO public.contract_clinics (contract_id, clinic_id)
SELECT c.id, f.id
FROM public.contracts c
JOIN public.clinics m ON m.id = c.clinic_id
JOIN public.clinics f ON f.parent_clinic_id = m.id
WHERE c.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.contracts fc 
    WHERE fc.clinic_id = f.id AND fc.active = true
  )
ON CONFLICT (contract_id, clinic_id) DO NOTHING;

-- =============================================
-- FASE 3: FUNÇÃO HELPER PARA RESOLUÇÃO DE CONTRATO EFETIVO
-- =============================================

CREATE OR REPLACE FUNCTION public.get_effective_contract_id(
    p_clinic_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
    v_contract_id UUID;
BEGIN
    -- 1. Primeiro verifica se a clínica possui contrato ativo direto ou via contract_clinics
    SELECT c.id INTO v_contract_id
    FROM public.contracts c
    JOIN public.contract_clinics cc ON cc.contract_id = c.id
    WHERE cc.clinic_id = p_clinic_id
      AND c.active = true
      AND c.valid_from <= p_date
      AND (c.valid_to IS NULL OR c.valid_to >= p_date)
    ORDER BY (c.clinic_id = p_clinic_id) DESC, c.valid_from DESC
    LIMIT 1;

    -- 2. Se não encontrou e a clínica é uma filial, tenta buscar o contrato ativo da matriz
    IF v_contract_id IS NULL THEN
        SELECT c.id INTO v_contract_id
        FROM public.contracts c
        JOIN public.clinics fil ON fil.id = p_clinic_id
        WHERE c.clinic_id = fil.parent_clinic_id
          AND c.active = true
          AND c.valid_from <= p_date
          AND (c.valid_to IS NULL OR c.valid_to >= p_date)
        ORDER BY c.valid_from DESC
        LIMIT 1;
    END IF;

    RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- FASE 4: ATUALIZAÇÃO DAS POLÍTICAS RLS DE CONTRACTS
-- =============================================

DROP POLICY IF EXISTS "Users view group contracts" ON public.contracts;
CREATE POLICY "Users view group contracts" ON public.contracts 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
  OR EXISTS (
    SELECT 1 FROM public.contract_clinics cc
    WHERE cc.contract_id = id
      AND public.user_can_access_clinic(cc.clinic_id)
  )
);
