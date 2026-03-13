/**
 * Formats a number as a currency string in Brazilian Real (BRL).
 * @param value The numeric value to format
 * @returns A formatted string e.g. "R$ 1.365,82"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Formats a number with Brazilian locale separators but without the currency symbol.
 * @param value The numeric value to format
 * @returns A formatted string e.g. "1.365,82"
 */
export function formatNumberBR(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0,00'
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
