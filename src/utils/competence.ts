/**
 * Utilitários para governança e cálculo de competências com base no dia de fechamento (competence_end_day) da clínica.
 */

export interface CompetenceInfo {
  month: number
  year: number
  monthYear: string // Formato MM/YYYY
}

export interface CompetenceDateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

/**
 * Calcula a competência (mês e ano) a partir da data do atendimento e do dia de fechamento da clínica.
 * Exemplo: Se competenceEndDay = 25 e a data for 26/06/2026, a competência é 07/2026.
 * Se a data for 25/07/2026, a competência é 07/2026.
 * Se a data for 26/07/2026, a competência é 08/2026.
 */
export function getCompetenceForDate(dateStr: string, competenceEndDay: number = 31): CompetenceInfo {
  const parts = dateStr ? dateStr.split('-') : []
  if (parts.length < 3) {
    const now = new Date()
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      monthYear: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
    }
  }

  let yearNum = parseInt(parts[0], 10)
  let monthNum = parseInt(parts[1], 10)
  const dayNum = parseInt(parts[2], 10)

  // Sanitização de sanidade para datas corrompidas
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2099) {
    yearNum = new Date().getFullYear()
  }
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    monthNum = new Date().getMonth() + 1
  }

  let calculatedMonth = monthNum
  let calculatedYear = yearNum
  const endDay = competenceEndDay && competenceEndDay >= 1 && competenceEndDay <= 31 ? competenceEndDay : 31

  if (dayNum > endDay && endDay < 31) {
    calculatedMonth += 1
    if (calculatedMonth > 12) {
      calculatedMonth = 1
      calculatedYear += 1
    }
  }

  const monthYear = `${String(calculatedMonth).padStart(2, '0')}/${calculatedYear}`

  return {
    month: calculatedMonth,
    year: calculatedYear,
    monthYear
  }
}

/**
 * Retorna o intervalo de datas (start_date e end_date) correspondente a uma competência (mês/ano) e dia de fechamento.
 * Exemplo: Para month = 7, year = 2026 e competenceEndDay = 25:
 * startDate = '2026-06-26', endDate = '2026-07-25'
 */
export function getCompetenceDateRange(month: number, year: number, competenceEndDay: number = 31): CompetenceDateRange {
  const endDay = competenceEndDay && competenceEndDay >= 1 && competenceEndDay <= 31 ? competenceEndDay : 31

  if (endDay >= 31) {
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
    return { startDate, endDate }
  }

  // Se endDay < 31:
  // Data final é o próprio endDay do mês da competência
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  // Data inicial é o dia seguinte ao endDay do mês anterior
  let prevMonth = month - 1
  let prevYear = year
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear = year - 1
  }

  const startDay = endDay + 1
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`

  return { startDate, endDate }
}

/**
 * Formata mês e ano em MM/YYYY
 */
export function formatCompetence(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${year}`
}

/**
 * Retorna o período da competência formatado em padrão brasileiro (DD/MM/YYYY a DD/MM/YYYY)
 * Exemplo: Para mês 8/2026 com fechamento dia 24 -> "25/07/2026 a 24/08/2026"
 */
export function formatCompetencePeriod(month: number, year: number, competenceEndDay: number = 31): string {
  const { startDate, endDate } = getCompetenceDateRange(month, year, competenceEndDay)
  const formatBR = (isoDate: string) => {
    const parts = isoDate.split('-')
    if (parts.length < 3) return isoDate
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return `${formatBR(startDate)} a ${formatBR(endDate)}`
}
