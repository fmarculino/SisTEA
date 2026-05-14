import { createClient } from '@/utils/supabase/server'

// Utilitários de formatação
const padRight = (str: string | null | undefined, length: number) => {
  return (str || '').substring(0, length).padEnd(length, ' ');
};

const padLeft = (num: number | string | null | undefined, length: number, char: string = '0') => {
  return String(num || 0).substring(0, length).padStart(length, char);
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

    // Query otimizada usando Joins
    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id,
        professional_cbo,
        patients!inner ( name, cns_patient, ibge_code, gender, race_color ),
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
    // 1. Antes de gerar, garantimos que não tem erros críticos
    const validation = await this.validateExport(clinic_id, month_year);
    if (validation.hasErrors) {
      throw new Error('Não é possível exportar. Existem inconsistências nos cadastros.');
    }

    const supabase = await createClient();

    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id, attendance_date, quantity, attendance_character, professional_cbo,
        patients!inner ( name, cns_patient, birth_date, gender, ibge_code, race_color, nationality, ethnicity, cep, address_street, address_complement, address_neighborhood, address_number, city ),
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
    const compYYYYMM = month_year.replace('/', '').replace('-', ''); // Adapte conforme o formato salvo no banco

    // --- Header ---
    // Estrutura simplificada de exemplo do Cabeçalho BPA
    // 01(2) | #BPA#(5) | AAAAMM(6) | Linhas(6) | Folhas(6) | Controle(4) | Orgao(15) | CNPJ(14) | ...
    const headerLine = 
      '01' +
      '#BPA#' +
      padRight(compYYYYMM, 6) +
      padLeft(attendances.length, 6) +
      padLeft(1, 6) + // Folhas
      '0000' + // Controle
      padRight(clinic.orgao_emissor || clinic.cnes, 15) +
      padRight(clinic.cnpj?.replace(/\D/g, ''), 14) +
      padRight(clinic.name, 30);
      
    lines.push(padRight(headerLine, 100)); // Ajuste de tamanho da linha do Header

    // --- Linhas de Produção ---
    attendances.forEach((att: any) => {
      const procCode = att.procedures.code.replace(/\D/g, ''); // 00.00.00.000-0 -> 0000000000

      if (att.procedures.bpa_type === 'BPA_C') {
        // Exemplo simplificado BPA-C (Consolidado)
        // 02(2) | CNES(7) | Comp(6) | CBO(6) | Proc(10) | Idade(3) | Qtd(2)
        const line = 
          '02' +
          padRight(clinic.cnes, 7) +
          padRight(compYYYYMM, 6) +
          padRight(att.professional_cbo, 6) +
          padRight(procCode, 10) +
          padLeft(0, 3) + // Idade calculada (simplificado aqui)
          padLeft(att.quantity, 2);

        lines.push(padRight(line, 100)); // Tamanho fixo do BPA-C

      } else if (att.procedures.bpa_type === 'BPA_I' || att.procedures.bpa_type === 'AMBOS') {
        // Exemplo simplificado BPA-I (Individualizado)
        // 03(2) | CNES(7) | Comp(6) | CNS Prof(15) | CBO(6) | Data Atend(8) | Proc(10) | CNS Pac(15) | Sexo(1) | IBGE(6) ...
        const attDate = new Date(att.attendance_date).toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
        
        let genderCode = 'I';
        if (att.patients.gender === 'Masculino') genderCode = 'M';
        if (att.patients.gender === 'Feminino') genderCode = 'F';

        const line = 
          '03' +
          padRight(clinic.cnes, 7) +
          padRight(compYYYYMM, 6) +
          padRight(att.professionals.cns, 15) +
          padRight(att.professional_cbo, 6) +
          padRight(attDate, 8) +
          padRight(procCode, 10) +
          padRight(att.patients.cns_patient, 15) +
          padRight(genderCode, 1) +
          padRight(att.patients.ibge_code, 6);
          // Faltam campos de raça, endereço e nacionalidade que exigem mapping exato.

        lines.push(padRight(line, 100)); // Tamanho fixo do BPA-I
      }
    });

    return lines.join('\r\n'); // DATASUS requer padrão Windows (CRLF)
  }
}
