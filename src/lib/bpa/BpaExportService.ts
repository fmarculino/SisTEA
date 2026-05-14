import { createClient } from '@/utils/supabase/server'

// Utilitários de formatação
const padRight = (str: string | null | undefined, length: number) => {
  return (str || '').substring(0, length).padEnd(length, ' ');
};

const padLeft = (num: number | string | null | undefined, length: number, char: string = '0') => {
  const sanitized = String(num || '').replace(/\D/g, ''); // Garante que campos numéricos tenham apenas dígitos antes do pad
  return sanitized.substring(0, length).padStart(length, char);
};

const sanitize = (str: string | null | undefined) => {
  return (str || '').replace(/\D/g, '');
};

const sanitizePhone = (str: string | null | undefined) => {
  return (str || '').replace(/\D/g, '').substring(0, 11);
};

const sanitizeCid = (str: string | null | undefined) => {
  return (str || '').replace(/[\s.-]/g, '').toUpperCase().substring(0, 4);
};

const normalizeText = (str: string | null | undefined) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .trim();
};

const mapRaceColor = (race: string | null | undefined): string => {
  const r = (race || '').toLowerCase();
  if (r.includes('branc')) return '01';
  if (r.includes('pret')) return '02';
  if (r.includes('pard')) return '03';
  if (r.includes('amarel')) return '04';
  if (r.includes('indig')) return '05';
  return '99';
};

export interface BpaValidationResult {
  hasErrors: boolean;
  errors: {
    attendance_id: string;
    patient_name: string;
    missing_fields: string[];
  }[];
}

export class BpaExportService {
  /**
   * Varredura Pre-flight: Retorna inconsistências que impediriam a geração correta do BPA.
   */
  static async validateExport(clinic_id: string, month_year: string): Promise<BpaValidationResult> {
    const supabase = await createClient();

    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id,
        professional_cbo,
        patients!inner ( name, cns_patient, ibge_code, gender, birth_date, cep, address_street, address_number, address_neighborhood ),
        professionals!inner ( name, cns ),
        procedures!inner ( name, code, bpa_type ),
        clinics!inner ( cnes )
      `)
      .eq('clinic_id', clinic_id)
      .eq('month_year', month_year)
      .eq('status', 'Realizada');

    if (error) {
      throw new Error(`Erro ao buscar produções: ${error.message}`);
    }

    const errors: BpaValidationResult['errors'] = [];

    attendances.forEach((att: any) => {
      const missing = [];

      // Validações Clínica
      if (!att.clinics?.cnes) missing.push('Clínica sem CNES');

      // Validações Paciente (Crucial para BPA-I)
      if (att.procedures?.bpa_type === 'BPA_I' || att.procedures?.bpa_type === 'AMBOS') {
        if (!att.patients?.cns_patient) missing.push('Paciente sem CNS');
        if (!att.patients?.ibge_code) missing.push('Paciente sem Código IBGE');
        if (!att.patients?.birth_date) missing.push('Paciente sem Data de Nascimento');
        if (!att.patients?.cep) missing.push('Paciente sem CEP');
        if (!att.patients?.address_street) missing.push('Paciente sem Logradouro');
        if (!att.patients?.address_neighborhood) missing.push('Paciente sem Bairro');
        if (att.patients?.gender === 'Não Informado') missing.push('Paciente com Sexo não informado');
      }

      // Validações Profissional
      if (!att.professionals?.cns) missing.push('Profissional sem CNS');
      if (!att.professional_cbo) missing.push('CBO não identificado para este atendimento');

      // Validações Procedimento
      if (!att.procedures?.code) missing.push('Procedimento sem Código SUS');
      if (att.procedures?.bpa_type === 'NAO_APLICA') missing.push('Procedimento sem Tipo BPA definido (BPA-I/BPA-C)');

      if (missing.length > 0) {
        errors.push({
          attendance_id: att.id,
          patient_name: att.patients?.name || 'Desconhecido',
          missing_fields: missing,
        });
      }
    });

    return {
      hasErrors: errors.length > 0,
      errors,
    };
  }

  /**
   * Gera o conteúdo TXT no formato DATASUS
   */
  static async generateTxt(clinic_id: string, month_year: string): Promise<string> {
    const validation = await this.validateExport(clinic_id, month_year);
    if (validation.hasErrors) {
      throw new Error('Não é possível exportar. Existem inconsistências nos cadastros.');
    }

    const supabase = await createClient();

    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id, attendance_date, quantity, attendance_character, professional_cbo,
        patients!inner ( name, cns_patient, birth_date, gender, ibge_code, race_color, nationality, ethnicity, cep, address_street, address_complement, address_neighborhood, address_number, city, phone ),
        professionals!inner ( name, cns ),
        procedures!inner ( name, code, bpa_type ),
        clinics!inner ( name, cnes, cnpj, orgao_emissor )
      `)
      .eq('clinic_id', clinic_id)
      .eq('month_year', month_year)
      .eq('status', 'Realizada');

    if (error || !attendances) {
      throw new Error('Erro ao buscar dados para exportação.');
    }

    if (attendances.length === 0) {
      throw new Error('Nenhuma produção encontrada para esta competência.');
    }

    const clinic = attendances[0].clinics as any;
    const lines: string[] = [];
    
    // Formata competência de MM/YYYY para YYYYMM
    const [month, year] = month_year.split('/');
    const compYYYYMM = `${year}${month.padStart(2, '0')}`;

    // --- Cálculo do Checksum (Control Field) ---
    // Regra: (Soma das Qtds + Soma dos Procs) % 1111 + 1111
    let sumQty = 0;
    let sumProcs = 0;
    attendances.forEach((att: any) => {
      sumQty += Number(att.quantity || 1);
      sumProcs += Number(sanitize(att.procedures.code));
    });
    const checksum = (sumQty + sumProcs) % 1111 + 1111;

    // --- Header (Registro 01) - 126 caracteres ---
    const headerLine = 
      '01' +                                      // 1-2: Identificador
      '#BPA#' +                                   // 3-7: Fixo
      compYYYYMM +                                // 8-13: Competência AAAAMM
      padLeft(attendances.length, 6) +            // 14-19: Total de Linhas
      padLeft(Math.ceil(attendances.length / 20), 6) + // 20-25: Total de Folhas (estimado)
      padLeft(checksum, 4) +                      // 26-29: Checksum
      padRight(clinic.name, 30) +                 // 30-59: Órgão Responsável
      padRight('SISTEA', 6) +                     // 60-65: Sigla
      padLeft(clinic.cnpj, 14) +                  // 66-79: CNPJ
      padRight('', 40) +                          // 80-119: Destino (Vazio)
      'M' +                                       // 120: Destino Indicador (M=Municipal)
      padRight('MD04.12', 10);                    // 121-130: Versão (exemplo)
      
    lines.push(headerLine.substring(0, 126));

    // --- Linhas de Produção ---
    attendances.forEach((att: any, index: number) => {
      const procCode = sanitize(att.procedures.code);
      const folha = Math.ceil((index + 1) / 20);
      const sequencial = (index % 20) + 1;

      if (att.procedures.bpa_type === 'BPA_C') {
        // BPA-C (Consolidado)
        const line = 
          '02' +                                  // 1-2
          padLeft(clinic.cnes, 7) +               // 3-9
          compYYYYMM +                            // 10-15
          padLeft(procCode, 10) +                 // 16-25
          padLeft(att.quantity, 6);               // 26-31
        
        lines.push(padRight(line, 350));
      } else {
        // BPA-I (Individualizado) - 350 caracteres fixos
        const attDate = sanitize(att.attendance_date); // YYYYMMDD
        const birthDate = sanitize(att.patients.birth_date); // YYYYMMDD
        
        const genderCode = att.patients.gender === 'Feminino' ? 'F' : 'M';

        // Cálculo simples de idade
        const age = birthDate ? Math.floor((new Date().getTime() - new Date(att.patients.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

        const line = 
          '03' +                                  // 1-2
          padLeft(clinic.cnes, 7) +               // 3-9
          compYYYYMM +                            // 10-15
          padLeft(att.professionals.cns, 15) +    // 16-30
          padRight(att.professional_cbo, 6) +     // 31-36
          attDate +                               // 37-44
          padLeft(folha, 3) +                     // 45-47
          padLeft(sequencial, 2) +                // 48-49
          padLeft(procCode, 10) +                 // 50-59
          padLeft(att.patients.cns_patient, 15) + // 60-74
          genderCode +                            // 75
          padLeft(att.patients.ibge_code, 6) +    // 76-81
          padRight(sanitizeCid(att.cid || 'F840'), 4) + // 82-85
          padLeft(age, 3) +                       // 86-88
          padLeft(att.quantity, 6) +              // 89-94
          padLeft(att.attendance_character || '01', 2) + // 95-96
          padRight('', 13) +                      // 97-109 (Autorização)
          'BPA' +                                 // 110-112 (Origem)
          padRight(normalizeText(att.patients.name), 30) + // 113-142 (Nome)
          birthDate +                             // 143-150 (Data Nasc)
          mapRaceColor(att.patients.race_color) + // 151-152 (Raça)
          padLeft(att.patients.ethnicity || '', 4) + // 153-156 (Etnia)
          padLeft(att.patients.nationality || '010', 3) + // 157-159 (Nacionalidade)
          padLeft(att.patients.ibge_code, 6) +    // 160-165 (Município Residência)
          padRight('', 26) +                      // 166-191 (RESERVA / BRANCOS)
          padLeft(sanitize(att.patients.cep), 8) + // 192-199 (CEP)
          padRight(normalizeText(att.patients.address_number), 5) + // 200-204 (Número)
          padRight(normalizeText(att.patients.address_complement), 10) + // 205-214 (Complemento)
          padRight(normalizeText(att.patients.address_street), 30) + // 215-244 (Logradouro/Rua)
          padRight(normalizeText(att.patients.address_neighborhood), 30) + // 245-274 (Bairro)
          padRight(sanitizePhone(att.patients.phone), 11); // 275-285 (Telefone)

        lines.push(padRight(line, 350)); 
      }
    });

    return lines.join('\r\n'); // DATASUS requer padrão Windows (CRLF)
  }

  /**
   * Sugere o nome do arquivo seguindo o padrão BPA_CNES_AAAAMM.EXT
   */
  static async getSuggestedFilename(clinic_id: string, month_year: string): Promise<string> {
    const supabase = await createClient();
    const { data: clinic } = await supabase.from('clinics').select('cnes').eq('id', clinic_id).single();
    
    const [month, year] = month_year.split('/');
    const compAAAAMM = `${year}${month.padStart(2, '0')}`;
    const cnes = clinic?.cnes || '0000000';

    const extensions: Record<string, string> = {
      '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR',
      '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO',
      '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ'
    };

    const ext = extensions[month.padStart(2, '0')] || 'TXT';
    return `BPA_${cnes}_${compAAAAMM}.${ext}`;
  }
}
