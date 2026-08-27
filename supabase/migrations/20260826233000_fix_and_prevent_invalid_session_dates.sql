-- =========================================================================
-- MIGRATION: Correção e Blindagem Contra Anos e Datas Inválidas
-- =========================================================================

-- 1. Normalizar anos anômalos em attendance_sessions
UPDATE public.attendance_sessions
SET session_date = (
  CASE 
    WHEN EXTRACT(YEAR FROM session_date) > 2035 OR EXTRACT(YEAR FROM session_date) < 2020 THEN
      TO_DATE('2026-' || TO_CHAR(EXTRACT(MONTH FROM session_date), 'FM00') || '-' || TO_CHAR(LEAST(EXTRACT(DAY FROM session_date)::int, 28), 'FM00'), 'YYYY-MM-DD')
    ELSE session_date
  END
)
WHERE EXTRACT(YEAR FROM session_date) > 2035 OR EXTRACT(YEAR FROM session_date) < 2020;

-- 2. Normalizar anos anômalos em attendances (attendance_date e authorization_date)
UPDATE public.attendances
SET attendance_date = (
  CASE 
    WHEN EXTRACT(YEAR FROM attendance_date) > 2035 OR EXTRACT(YEAR FROM attendance_date) < 2020 THEN
      TO_DATE('2026-' || TO_CHAR(EXTRACT(MONTH FROM attendance_date), 'FM00') || '-' || TO_CHAR(LEAST(EXTRACT(DAY FROM attendance_date)::int, 28), 'FM00'), 'YYYY-MM-DD')
    ELSE attendance_date
  END
)
WHERE EXTRACT(YEAR FROM attendance_date) > 2035 OR EXTRACT(YEAR FROM attendance_date) < 2020;

UPDATE public.attendances
SET authorization_date = (
  CASE 
    WHEN authorization_date IS NOT NULL AND (EXTRACT(YEAR FROM authorization_date) > 2035 OR EXTRACT(YEAR FROM authorization_date) < 2020) THEN
      TO_DATE('2026-' || TO_CHAR(EXTRACT(MONTH FROM authorization_date), 'FM00') || '-' || TO_CHAR(LEAST(EXTRACT(DAY FROM authorization_date)::int, 28), 'FM00'), 'YYYY-MM-DD')
    ELSE authorization_date
  END
)
WHERE authorization_date IS NOT NULL AND (EXTRACT(YEAR FROM authorization_date) > 2035 OR EXTRACT(YEAR FROM authorization_date) < 2020);

-- 3. Recalcular month_year em attendances que estejam desalinhados
UPDATE public.attendances a
SET month_year = public.calculate_competence_month_year(a.attendance_date, COALESCE(c.competence_end_day, 31))
FROM public.clinics c
WHERE a.clinic_id = c.id
  AND (a.month_year NOT SIMILAR TO '(0[1-9]|1[0-2])/(202[0-9]|203[0-5])' OR a.month_year IS NULL);

-- 4. Adicionar Constraints de integridade no banco de dados
ALTER TABLE public.attendance_sessions 
  DROP CONSTRAINT IF EXISTS chk_attendance_sessions_date_range;

ALTER TABLE public.attendance_sessions 
  ADD CONSTRAINT chk_attendance_sessions_date_range 
  CHECK (session_date >= '2020-01-01' AND session_date <= '2035-12-31');

ALTER TABLE public.attendances 
  DROP CONSTRAINT IF EXISTS chk_attendances_date_range;

ALTER TABLE public.attendances 
  ADD CONSTRAINT chk_attendances_date_range 
  CHECK (attendance_date >= '2020-01-01' AND attendance_date <= '2035-12-31');

ALTER TABLE public.attendances 
  DROP CONSTRAINT IF EXISTS chk_attendances_auth_date_range;

ALTER TABLE public.attendances 
  ADD CONSTRAINT chk_attendances_auth_date_range 
  CHECK (authorization_date IS NULL OR (authorization_date >= '2020-01-01' AND authorization_date <= '2035-12-31'));
