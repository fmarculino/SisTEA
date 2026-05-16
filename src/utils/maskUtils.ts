/**
 * Utilitários de Máscara para o SisTEA
 * Focado em performance e UX para operadores.
 */

export const applyMask = (value: string, type: 'procedure' | 'cpf' | 'cnpj' | 'cns' | 'cid' | 'none' | 'auto'): string => {
  if (type === 'auto') return detectAndMask(value)
  // Remove tudo que não é alfanumérico para processar
  const cleanValue = value.replace(/[^\w]/g, '').toUpperCase()

  if (!cleanValue) return ''

  switch (type) {
    case 'procedure': {
      // Máscara SIGTAP: 03.01.01.007-2 (10 dígitos)
      // Padrão: ##.##.##.###-#
      const digits = cleanValue.replace(/\D/g, '').slice(0, 10)
      let masked = digits
      if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`
      if (digits.length > 4) masked = `${masked.slice(0, 5)}.${digits.slice(4)}`
      if (digits.length > 6) masked = `${masked.slice(0, 8)}.${digits.slice(6)}`
      if (digits.length > 9) masked = `${masked.slice(0, 12)}-${digits.slice(9)}`
      return masked
    }

    case 'cpf': {
      // CPF: 000.000.000-00 (11 dígitos)
      const digits = cleanValue.replace(/\D/g, '').slice(0, 11)
      let masked = digits
      if (digits.length > 3) masked = `${digits.slice(0, 3)}.${digits.slice(3)}`
      if (digits.length > 6) masked = `${masked.slice(0, 7)}.${digits.slice(6)}`
      if (digits.length > 9) masked = `${masked.slice(0, 11)}-${digits.slice(9)}`
      return masked
    }

    case 'cnpj': {
      // CNPJ: 00.000.000/0000-00 (14 dígitos)
      const digits = cleanValue.replace(/\D/g, '').slice(0, 14)
      let masked = digits
      if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`
      if (digits.length > 5) masked = `${masked.slice(0, 6)}.${digits.slice(5)}`
      if (digits.length > 8) masked = `${masked.slice(0, 10)}/${digits.slice(8)}`
      if (digits.length > 12) masked = `${masked.slice(0, 15)}-${digits.slice(12)}`
      return masked
    }

    case 'cns': {
      // CNS: 000.0000.0000.0000 (15 dígitos)
      const digits = cleanValue.replace(/\D/g, '').slice(0, 15)
      let masked = digits
      if (digits.length > 3) masked = `${digits.slice(0, 3)}.${digits.slice(3)}`
      if (digits.length > 7) masked = `${masked.slice(0, 8)}.${digits.slice(7)}`
      if (digits.length > 11) masked = `${masked.slice(0, 13)}.${digits.slice(11)}`
      return masked
    }

    case 'cid': {
      // CID-10: F84.0 ou F840
      // Apenas garante que seja maiúsculo e limita tamanho
      return cleanValue.slice(0, 4)
    }

    default:
      return value
  }
}

/**
 * Detecta automaticamente o tipo de conteúdo baseado no que está sendo digitado
 * Útil para campos de busca genéricos.
 */
export const detectAndMask = (value: string): string => {
  const clean = value.replace(/[^\w]/g, '')
  
  // Se for apenas números
  if (/^\d+$/.test(clean)) {
    if (clean.length <= 10 && (clean.startsWith('0') || clean.startsWith('1'))) {
      return applyMask(value, 'procedure')
    }
    if (clean.length === 11) return applyMask(value, 'cpf')
    if (clean.length === 14) return applyMask(value, 'cnpj')
    if (clean.length === 15) return applyMask(value, 'cns')
  }
  
  return value
}
