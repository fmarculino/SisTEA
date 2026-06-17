-- =========================================================================
-- MIGRATION: Fix User Clinics SELECT RLS Policy for clinic groups
-- 
-- Permite que usuários com papel de prestador externo (como GERENTE)
-- visualizem os registros na tabela user_clinics de outros usuários
-- associados a clínicas do seu grupo (matriz e filiais).
-- 
-- Isso é fundamental para que a política RLS "Users view group users"
-- funcione corretamente, pois ela faz um sub-select EXISTS na tabela user_clinics.
-- =========================================================================

-- Remover política antiga restritiva que limitava a visualizar apenas o próprio registro
DROP POLICY IF EXISTS "Clinic users view own user_clinics" ON public.user_clinics;

-- Criar nova política baseada em acesso a clínicas do grupo
CREATE POLICY "Clinic users view group user_clinics" ON public.user_clinics
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR user_id = auth.uid()
  OR public.user_can_access_clinic(clinic_id)
);
