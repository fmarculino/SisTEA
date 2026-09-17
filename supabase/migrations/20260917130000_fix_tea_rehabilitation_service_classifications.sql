-- Migration: Vinculação e Correção de Serviço/Classificação 135/010 para Reabilitação TEA
-- Objetivo: Garantir que os procedimentos de Reabilitação Intelectual / Neuropsicomotor / Múltiplas Deficiências
-- (0301070075, 0301070067, 0301070024, 0301070113) estejam devidamente associados à Classificação 135/010
-- no cadastro de procedimentos e em todos os atendimentos existentes (incluindo competências 07/2026 e 08/2026).

DO $$
DECLARE
  v_sc_id uuid;
BEGIN
  -- 1. Obter ou criar a classificação 135/010 (Reabilitação Intelectual / Autismo)
  SELECT id INTO v_sc_id 
  FROM public.service_classifications 
  WHERE service_code = '135' AND classification_code = '010' 
  LIMIT 1;

  IF v_sc_id IS NULL THEN
    INSERT INTO public.service_classifications (service_code, classification_code, name, active)
    VALUES ('135', '010', 'Reabilitação Intelectual / Autismo', true)
    RETURNING id INTO v_sc_id;
  END IF;

  -- 2. Limpar vínculos antigos incorretos com 135/002 para estes procedimentos específicos
  DELETE FROM public.procedure_service_classifications psc
  USING public.procedures p, public.service_classifications sc
  WHERE psc.procedure_id = p.id
    AND psc.service_classification_id = sc.id
    AND p.code IN ('0301070075', '0301070067', '0301070024', '0301070113')
    AND sc.service_code = '135' AND sc.classification_code = '002';

  -- 3. Vincular a classificação 135/010 a cada um dos procedimentos de reabilitação
  INSERT INTO public.procedure_service_classifications (procedure_id, service_classification_id)
  SELECT p.id, v_sc_id
  FROM public.procedures p
  WHERE p.code IN ('0301070075', '0301070067', '0301070024', '0301070113')
    AND NOT EXISTS (
      SELECT 1 FROM public.procedure_service_classifications psc
      WHERE psc.procedure_id = p.id AND psc.service_classification_id = v_sc_id
    );

  -- 4. Atualizar todos os atendimentos desses procedimentos no banco para apontar para 135/010
  UPDATE public.attendances a
  SET service_classification_id = v_sc_id
  FROM public.procedures p
  WHERE a.procedure_id = p.id
    AND p.code IN ('0301070075', '0301070067', '0301070024', '0301070113')
    AND (a.service_classification_id IS DISTINCT FROM v_sc_id);

END $$;
