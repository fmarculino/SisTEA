-- =========================================================================
-- MIGRATION: Fix Patient Clinics RLS Policy for clinic groups
-- 
-- Permite que usuários com papel de prestador externo (como GERENTE)
-- visualizem e gerenciem os vínculos de pacientes para todas as clínicas
-- do seu grupo (matriz e filiais), e não apenas sua clínica padrão.
-- =========================================================================

-- Habilitar RLS se não estiver
ALTER TABLE public.patient_clinics ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas restrictivas
DROP POLICY IF EXISTS "SMS_ADMIN full access patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "CLINIC_USER manage own patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "Clinic users view own patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "Clinic users manage own patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "CLINIC_USER manage own clinic patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "Users view own patient_clinics" ON public.patient_clinics;
DROP POLICY IF EXISTS "CLINIC_USER manage group patient_clinics" ON public.patient_clinics;

-- Criar nova política baseada em grupos
CREATE POLICY "CLINIC_USER manage group patient_clinics" ON public.patient_clinics 
FOR ALL USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR public.user_can_access_clinic(clinic_id)
);
