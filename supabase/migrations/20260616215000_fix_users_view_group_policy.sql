-- =========================================================================
-- MIGRATION: Fix Users View Group Policy shadow column bug
-- 
-- Corrige a política RLS "Users view group users" na tabela de usuários.
-- O campo id na subquery estava sendo interpretado como o PK da tabela
-- user_clinics (uc.id), fazendo com que a comparação uc.user_id = id
-- falhasse sempre (uc.user_id = uc.id).
-- 
-- Explicitamos o uso de users.id para referenciar o ID da tabela externa.
-- =========================================================================

DROP POLICY IF EXISTS "Users view group users" ON public.users;

CREATE POLICY "Users view group users" ON public.users 
FOR SELECT USING (
  public.get_user_role() IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')
  OR id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_clinics uc 
    WHERE uc.user_id = users.id 
    AND public.user_can_access_clinic(uc.clinic_id)
  )
);
