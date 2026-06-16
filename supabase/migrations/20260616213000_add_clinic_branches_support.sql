-- =========================================================================
-- MIGRATION: Suporte a Clínicas Filiais (Unidades Vinculadas)
-- 
-- Implementa o modelo Matriz/Filial para clínicas que operam em múltiplas
-- unidades físicas mas compartilham contrato, CNES, competência e BPA.
--
-- Mudanças principais:
-- 1. Campo parent_clinic_id na tabela clinics (auto-referencial)
-- 2. Tabela user_clinics para vínculo N:N entre usuários e clínicas
-- 3. Funções helper para navegação de grupo
-- 4. Reestruturação das políticas RLS para acesso multi-clinic
-- =========================================================================

-- =============================================
-- FASE 1: CAMPO parent_clinic_id NA TABELA clinics
-- =============================================

ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS parent_clinic_id UUID REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Índice para performance nas queries de grupo
CREATE INDEX IF NOT EXISTS idx_clinics_parent_id ON public.clinics(parent_clinic_id);

-- Constraint: Impede auto-referência (uma clínica não pode ser filial de si mesma)
ALTER TABLE public.clinics ADD CONSTRAINT clinics_no_self_parent 
CHECK (parent_clinic_id IS DISTINCT FROM id);

-- Constraint: Filial não pode ter filiais (apenas 1 nível de hierarquia)
-- Implementada via trigger abaixo
CREATE OR REPLACE FUNCTION public.check_clinic_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- Se estamos definindo um parent_clinic_id, verificar que o parent NÃO é uma filial
  IF NEW.parent_clinic_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.clinics 
      WHERE id = NEW.parent_clinic_id 
      AND parent_clinic_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Não é permitido criar filial de uma filial. Apenas clínicas matrizes podem ter filiais.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_clinic_hierarchy ON public.clinics;
CREATE TRIGGER trg_check_clinic_hierarchy
BEFORE INSERT OR UPDATE OF parent_clinic_id ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.check_clinic_hierarchy();


-- =============================================
-- FASE 2: TABELA user_clinics (Vínculo N:N)
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_clinic UNIQUE(user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_user_clinics_user ON public.user_clinics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clinics_clinic ON public.user_clinics(clinic_id);

-- Trigger: Garantir que apenas 1 clínica é default por usuário
CREATE OR REPLACE FUNCTION public.ensure_single_default_clinic()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_clinics 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_clinic ON public.user_clinics;
CREATE TRIGGER trg_ensure_single_default_clinic
BEFORE INSERT OR UPDATE OF is_default ON public.user_clinics
FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_clinic();

-- RLS para user_clinics
ALTER TABLE public.user_clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SMS_ADMIN full access user_clinics"
ON public.user_clinics FOR ALL
USING (public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR'));

CREATE POLICY "Clinic users view own user_clinics"
ON public.user_clinics FOR SELECT
USING (user_id = auth.uid());


-- =============================================
-- FASE 3: MIGRAÇÃO DE DADOS users.clinic_id → user_clinics
-- =============================================

-- Migrar vínculos existentes para a nova tabela
INSERT INTO public.user_clinics (user_id, clinic_id, is_default)
SELECT id, clinic_id, true
FROM public.users
WHERE clinic_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO NOTHING;


-- =============================================
-- FASE 4: FUNÇÕES HELPER PARA NAVEGAÇÃO DE GRUPO
-- =============================================

-- Retorna o ID da clínica matriz (se já for matriz, retorna ela mesma)
CREATE OR REPLACE FUNCTION public.get_matrix_clinic_id(p_clinic_id UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT parent_clinic_id FROM public.clinics WHERE id = p_clinic_id AND parent_clinic_id IS NOT NULL),
    p_clinic_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna todos os IDs do grupo (matriz + todas as filiais)
CREATE OR REPLACE FUNCTION public.get_clinic_group_ids(p_clinic_id UUID)
RETURNS UUID[] AS $$
DECLARE
  v_matrix_id UUID;
BEGIN
  -- Encontra a matriz
  v_matrix_id := public.get_matrix_clinic_id(p_clinic_id);
  
  -- Retorna a matriz + todas as filiais
  RETURN ARRAY(
    SELECT id FROM public.clinics 
    WHERE id = v_matrix_id 
    OR parent_clinic_id = v_matrix_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Retorna todos os clinic_ids que o usuário logado pode acessar
-- (inclui expansão de grupo para cada clínica vinculada)
CREATE OR REPLACE FUNCTION public.get_user_accessible_clinic_ids()
RETURNS UUID[] AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_result UUID[];
BEGIN
  v_user_id := auth.uid();
  v_role := public.get_user_role();
  
  -- Admins/SMS acessam tudo (retorna NULL = sem filtro)
  IF v_role IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR') THEN
    RETURN NULL;
  END IF;
  
  -- Para usuários de clínica: pega todas as clínicas vinculadas + seus grupos
  SELECT ARRAY(
    SELECT DISTINCT unnest(public.get_clinic_group_ids(uc.clinic_id))
    FROM public.user_clinics uc
    WHERE uc.user_id = v_user_id
  ) INTO v_result;
  
  RETURN COALESCE(v_result, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Substituição retrocompatível de get_user_clinic_id()
-- Agora retorna o clinic_id default do user_clinics, ou o primeiro disponível
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT clinic_id FROM public.user_clinics WHERE user_id = auth.uid() AND is_default = true LIMIT 1),
    (SELECT clinic_id FROM public.user_clinics WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1),
    (SELECT clinic_id FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =============================================
-- FASE 5: REESTRUTURAÇÃO DAS POLÍTICAS RLS
-- =============================================

-- Helper: Verifica se um clinic_id está acessível ao usuário corrente
CREATE OR REPLACE FUNCTION public.user_can_access_clinic(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_accessible UUID[];
BEGIN
  v_accessible := public.get_user_accessible_clinic_ids();
  
  -- NULL = admin (acesso total)
  IF v_accessible IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN p_clinic_id = ANY(v_accessible);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Clinics ──
DROP POLICY IF EXISTS "Users view own clinic" ON public.clinics;
CREATE POLICY "Users view group clinics" ON public.clinics 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(id)
);

-- ── Patients ──
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patients" ON public.patients;
CREATE POLICY "CLINIC_USER manage group patients" ON public.patients 
FOR ALL USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
);

-- ── Attendances ──
DROP POLICY IF EXISTS "Clinic users view own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Clinic users insert own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Clinic users update own attendances" ON public.attendances;
DROP POLICY IF EXISTS "Clinic users delete own attendances" ON public.attendances;

CREATE POLICY "Clinic users view group attendances" ON public.attendances 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
);

CREATE POLICY "Clinic users insert group attendances" ON public.attendances 
FOR INSERT WITH CHECK (
  public.user_can_access_clinic(clinic_id)
);

CREATE POLICY "Clinic users update group attendances" ON public.attendances 
FOR UPDATE USING (
  public.user_can_access_clinic(clinic_id)
);

CREATE POLICY "Clinic users delete group attendances" ON public.attendances 
FOR DELETE USING (
  public.user_can_access_clinic(clinic_id)
);

-- ── Contracts ──
DROP POLICY IF EXISTS "Users view own contracts" ON public.contracts;
CREATE POLICY "Users view group contracts" ON public.contracts 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
);

-- ── Professional Clinics ──
DROP POLICY IF EXISTS "CLINIC_USER manage own professional_clinics" ON public.professional_clinics;
CREATE POLICY "CLINIC_USER manage group professional_clinics" ON public.professional_clinics 
FOR ALL USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
);

-- ── Professionals (via professional_clinics junction) ──
DROP POLICY IF EXISTS "CLINIC_USER view own clinic professionals" ON public.professionals;
DROP POLICY IF EXISTS "CLINIC_USER update professionals" ON public.professionals;

CREATE POLICY "CLINIC_USER view group professionals" ON public.professionals 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = id 
    AND public.user_can_access_clinic(pc.clinic_id)
  )
);

CREATE POLICY "CLINIC_USER update group professionals" ON public.professionals 
FOR UPDATE USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = id 
    AND public.user_can_access_clinic(pc.clinic_id)
  )
);

-- ── Professional Specialties ──
DROP POLICY IF EXISTS "CLINIC_USER manage own professional_specialties" ON public.professional_specialties;
CREATE POLICY "CLINIC_USER manage group professional_specialties" ON public.professional_specialties 
FOR ALL USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR EXISTS (
    SELECT 1 FROM public.professional_clinics pc 
    WHERE pc.professional_id = professional_id 
    AND public.user_can_access_clinic(pc.clinic_id)
  )
) WITH CHECK (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR', 'GERENTE', 'RECEPCIONISTA', 'FATURISTA')
);

-- ── Users (visibilidade entre colegas da mesma clínica/grupo) ──
DROP POLICY IF EXISTS "Users view users from same clinic" ON public.users;
CREATE POLICY "Users view group users" ON public.users 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_clinics uc 
    WHERE uc.user_id = id 
    AND public.user_can_access_clinic(uc.clinic_id)
  )
);


-- =============================================
-- FASE 6: ATUALIZAR VIEW DE COMPETENCE BILLING SUMS
-- =============================================
-- A view precisa poder ser filtrada por grupo no frontend.
-- Mantemos o agrupamento por clinic_id + month_year (não muda a view em si),
-- mas a consolidação por grupo será feita no application layer.
-- A view já funciona corretamente pois o RLS agora dá acesso ao grupo inteiro.


-- =============================================
-- FASE 7: COMPETENCES — Garantir acesso por grupo
-- =============================================

-- Verificar se tabela competences existe e tem RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'competences' AND table_schema = 'public') THEN
    -- Atualizar políticas para permitir acesso por grupo
    EXECUTE 'DROP POLICY IF EXISTS "Users view own competences" ON public.competences';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users view own competences" ON public.competences';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users manage own competences" ON public.competences';
    
    EXECUTE 'CREATE POLICY "Users view group competences" ON public.competences 
    FOR SELECT USING (
      public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
      OR public.user_can_access_clinic(clinic_id)
    )';
    
    EXECUTE 'CREATE POLICY "Clinic users manage group competences" ON public.competences 
    FOR ALL USING (
      public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
      OR public.user_can_access_clinic(clinic_id)
    )';
  END IF;
END $$;

-- Mesma lógica para competence_audit_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'competence_audit_logs' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow clinic_user read own competence_audit_logs" ON public.competence_audit_logs';
    
    EXECUTE 'CREATE POLICY "Allow clinic_user read group competence_audit_logs" ON public.competence_audit_logs 
    FOR SELECT USING (
      public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
      OR public.user_can_access_clinic(clinic_id)
    )';
  END IF;
END $$;

-- Mesma lógica para attendance_sessions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_sessions' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users view own sessions" ON public.attendance_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users insert own sessions" ON public.attendance_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users update own sessions" ON public.attendance_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "CLINIC_USER manage own sessions" ON public.attendance_sessions';
    
    -- Sessions são acessíveis via attendance (que já tem RLS por grupo)
    -- Mas se tiver clinic_id direto, aplicar o mesmo padrão
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendance_sessions' AND column_name = 'clinic_id' AND table_schema = 'public'
    ) THEN
      EXECUTE 'CREATE POLICY "Clinic users view group sessions" ON public.attendance_sessions 
      FOR SELECT USING (
        public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
        OR public.user_can_access_clinic(clinic_id)
      )';
    END IF;
  END IF;
END $$;

-- Mesma lógica para attendance_attachments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_attachments' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users manage own attachments" ON public.attendance_attachments';
    EXECUTE 'DROP POLICY IF EXISTS "CLINIC_USER manage own attachments" ON public.attendance_attachments';
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendance_attachments' AND column_name = 'clinic_id' AND table_schema = 'public'
    ) THEN
      EXECUTE 'CREATE POLICY "Clinic users manage group attachments" ON public.attendance_attachments 
      FOR ALL USING (
        public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
        OR public.user_can_access_clinic(clinic_id)
      )';
    END IF;
  END IF;
END $$;

-- Mesma lógica para clinic_procedure_prices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinic_procedure_prices' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users view own prices" ON public.clinic_procedure_prices';
    EXECUTE 'DROP POLICY IF EXISTS "Clinic users view own prices" ON public.clinic_procedure_prices';
    
    EXECUTE 'CREATE POLICY "Users view group prices" ON public.clinic_procedure_prices 
    FOR SELECT USING (
      public.get_user_role() IN (''SMS_ADMIN'', ''REGULACAO'', ''COORDENADOR'', ''OPERADOR'')
      OR public.user_can_access_clinic(clinic_id)
    )';
  END IF;
END $$;
