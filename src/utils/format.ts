/**
 * Formats a number as a currency string in Brazilian Real (BRL).
 * @param value The numeric value to format
 * @returns A formatted string e.g. "R$ 1.365,82"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (value === null || value === undefined || isNaN(num)) return 'R$ 0,00'
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Formats a number with Brazilian locale separators but without the currency symbol.
 * @param value The numeric value to format
 * @returns A formatted string e.g. "1.365,82"
 */
export function formatNumberBR(value: number | string | null | undefined): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (value === null || value === undefined || isNaN(num)) return '0,00'
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Formats a YYYY-MM-DD or ISO date string to Brazilian format (DD/MM/YYYY)
 * completely immune to browser/server UTC timezone offset shifts.
 * @param dateStr The date string in YYYY-MM-DD or ISO format
 * @returns A formatted string e.g. "25/08/2026"
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const clean = dateStr.split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
  }
  return dateStr
}
