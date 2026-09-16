-- Adiciona campos exigidos pelas atualizações do BPA/DATASUS (Versão 05.00 e PNRV)
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS is_homeless BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_cpf_civil_registry BOOLEAN DEFAULT false;
