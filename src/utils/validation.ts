/**
 * Valida um número de CPF.
 */
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;
  
  // Bloqueia sequências iguais conhecidas
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

/**
 * Valida um número de Cartão Nacional de Saúde (CNS).
 * Suporta CNS começando com 1, 2, 7, 8 ou 9.
 */
export function validateCNS(cns: string): boolean {
  const cleanCNS = cns.replace(/\D/g, '');

  if (cleanCNS.length !== 15) return false;

  const firstDigit = cleanCNS[0];

  if (['1', '2'].includes(firstDigit)) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += parseInt(cleanCNS[i]) * (15 - i);
    }

    let rest = sum % 11;
    let dv = 11 - rest;

    if (dv === 11) dv = 0;

    let result = '';
    if (dv === 10) {
      sum = 0;
      for (let i = 0; i < 11; i++) {
        sum += parseInt(cleanCNS[i]) * (15 - i);
      }
      sum += 2;
      rest = sum % 11;
      dv = 11 - rest;
      result = cleanCNS.substring(0, 11) + '001' + dv.toString();
    } else {
      result = cleanCNS.substring(0, 11) + '000' + dv.toString();
    }

    return cleanCNS === result;
  }

  if (['7', '8', '9'].includes(firstDigit)) {
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      sum += parseInt(cleanCNS[i]) * (15 - i);
    }
    return sum % 11 === 0;
  }

  return false;
}
