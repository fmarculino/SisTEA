-- Migration: Expand user roles
-- Description: Altera as restrições na tabela public.users para permitir os novos papéis (SMS_ADMIN, REGULACAO, COORDENADOR, OPERADOR, GERENTE, RECEPCIONISTA, FATURISTA), migra CLINIC_USER para GERENTE e atualiza a obrigatoriedade de clínica.

-- 1. Remover temporariamente a restrição de CHECK antiga
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Migrar usuários existentes de CLINIC_USER para GERENTE
UPDATE public.users 
SET role = 'GERENTE' 
WHERE role = 'CLINIC_USER';

-- 3. Adicionar a nova restrição com todos os perfis válidos
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR', 'GERENTE', 'RECEPCIONISTA', 'FATURISTA'));

-- 4. Atualizar a restrição de clínica obrigatória para perfis da clínica
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS clinic_user_must_have_clinic;

ALTER TABLE public.users ADD CONSTRAINT clinic_user_must_have_clinic CHECK (
    (role IN ('SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR')) OR 
    (role IN ('GERENTE', 'RECEPCIONISTA', 'FATURISTA') AND clinic_id IS NOT NULL)
);
