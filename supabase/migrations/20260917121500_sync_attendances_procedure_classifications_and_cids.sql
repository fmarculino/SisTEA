-- Migration: Sincronização dos Atendimentos com Cadastros de Procedimentos
-- Objetivo: Atualizar registros de atendimentos legados/existentes com:
-- 1. Classificação DataSUS (service_classification_id) a partir da tabela procedure_service_classifications
-- 2. Limpeza de service_classification_id para procedimentos que não exigem serviço/classificação
-- 3. Correção de CID F840 para R498 no procedimento 0301070113 (Terapia Fonoaudiológica - compatível SIGTAP)

-- 1. Atualizar service_classification_id dos atendimentos a partir do configurado nos procedimentos
UPDATE public.attendances a
SET service_classification_id = psc.service_classification_id
FROM (
  SELECT DISTINCT ON (procedure_id) procedure_id, service_classification_id
  FROM public.procedure_service_classifications
) psc
WHERE a.procedure_id = psc.procedure_id
  AND (a.service_classification_id IS DISTINCT FROM psc.service_classification_id);

-- 2. Limpar service_classification_id dos atendimentos cujos procedimentos não possuem serviço/classificação vinculado (ex: 0301010048, 0301070059)
UPDATE public.attendances a
SET service_classification_id = NULL
WHERE a.procedure_id NOT IN (
  SELECT DISTINCT procedure_id FROM public.procedure_service_classifications
)
AND a.service_classification_id IS NOT NULL;

-- 3. Compatibilizar CID para R498 nos atendimentos de Fonoaudiologia (0301070113)
UPDATE public.attendances a
SET cid = 'R498'
FROM public.procedures p
WHERE a.procedure_id = p.id
  AND p.code = '0301070113'
  AND (a.cid = 'F840' OR a.cid IS NULL OR a.cid = '');
