-- =========================================================================
-- MIGRATION: Governança de Competência por competence_end_day da Clínica
-- =========================================================================

-- 1. Função utilitária para calcular a competência (MM/YYYY) com base na data e no dia de fechamento
CREATE OR REPLACE FUNCTION public.calculate_competence_month_year(p_date date, p_end_day integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day integer;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;
  v_day := EXTRACT(DAY FROM p_date);
  IF p_end_day IS NOT NULL AND p_end_day >= 1 AND p_end_day < 31 AND v_day > p_end_day THEN
    RETURN TO_CHAR(p_date + INTERVAL '1 month', 'MM/YYYY');
  ELSE
    RETURN TO_CHAR(p_date, 'MM/YYYY');
  END IF;
END;
$$;

-- 2. Trigger para garantir automaticamente a integridade de month_year em attendances
CREATE OR REPLACE FUNCTION public.trg_set_attendance_month_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_end_day integer;
BEGIN
  SELECT COALESCE(competence_end_day, 31) INTO v_end_day
  FROM public.clinics
  WHERE id = NEW.clinic_id;

  NEW.month_year := public.calculate_competence_month_year(NEW.attendance_date, COALESCE(v_end_day, 31));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_attendance_month_year_trg ON public.attendances;
CREATE TRIGGER set_attendance_month_year_trg
  BEFORE INSERT OR UPDATE OF attendance_date, clinic_id
  ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_attendance_month_year();

-- 3. Atualizar retroativamente todos os atendimentos existentes para sincronizar com o competence_end_day da sua respectiva clínica
UPDATE public.attendances a
SET month_year = public.calculate_competence_month_year(a.attendance_date, COALESCE(c.competence_end_day, 31))
FROM public.clinics c
WHERE a.clinic_id = c.id;
