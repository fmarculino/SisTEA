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
   * Resolve o ID da clínica matriz e retorna todos os IDs do grupo.
   * Se a clínica já for matriz, retorna ela mesma + filiais.
   * Se for filial, encontra a matriz e retorna o grupo completo.
   */
  private static async resolveGroupClinicIds(clinic_id: string): Promise<{ matrixId: string; groupIds: string[] }> {
    const supabase = await createClient();
    
    // Verificar se é filial
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, parent_clinic_id')
      .eq('id', clinic_id)
      .single();
    
    const matrixId = clinic?.parent_clinic_id || clinic_id;
    
    // Buscar todas as clínicas do grupo (matriz + filiais)
    const { data: groupClinics } = await supabase
      .from('clinics')
      .select('id')
      .or(`id.eq.${matrixId},parent_clinic_id.eq.${matrixId}`);
    
    const groupIds = (groupClinics || []).map((c: any) => c.id);
    
    // Garantir que pelo menos a clínica passada esteja no grupo
    if (groupIds.length === 0) groupIds.push(clinic_id);
    
    return { matrixId, groupIds };
  }

  /**
   * Varredura Pre-flight: Retorna inconsistências que impediriam a geração correta do BPA.
   * Consolida atendimentos de TODAS as unidades do grupo (matriz + filiais).
   */
  static async validateExport(clinic_id: string, month_year: string): Promise<BpaValidationResult> {
    const supabase = await createClient();
    const { matrixId, groupIds } = await this.resolveGroupClinicIds(clinic_id);

    // Buscar dados da matriz para validação do CNES
    const { data: matrixClinic } = await supabase
      .from('clinics')
      .select('cnes')
      .eq('id', matrixId)
      .single();

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
      .in('clinic_id', groupIds)
      .eq('month_year', month_year)
      .eq('status', 'Realizada');

    if (error) {
      throw new Error(`Erro ao buscar produções: ${error.message}`);
    }

    const errors: BpaValidationResult['errors'] = [];
    const validAttendances = (attendances || []).filter((att: any) => att.procedures?.code && att.procedures.code.trim() !== '');

    // Validar CNES da matriz (usado no cabeçalho do BPA)
    if (!matrixClinic?.cnes) {
      errors.push({
        attendance_id: 'HEADER',
        patient_name: 'Clínica Matriz',
        missing_fields: ['Clínica Matriz sem CNES configurado'],
      });
    }

    validAttendances.forEach((att: any) => {
      const missing = [];

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
   * Gera o conteúdo TXT no formato DATASUS.
   * Consolida atendimentos de TODAS as unidades do grupo em um arquivo único.
   * O cabeçalho usa CNPJ/CNES da MATRIZ.
   */
  static async generateTxt(clinic_id: string, month_year: string): Promise<string> {
    const validation = await this.validateExport(clinic_id, month_year);
    if (validation.hasErrors) {
      throw new Error('Não é possível exportar. Existem inconsistências nos cadastros.');
    }

    const supabase = await createClient();
    const { matrixId, groupIds } = await this.resolveGroupClinicIds(clinic_id);

    // Buscar dados da MATRIZ para o cabeçalho do BPA
    const { data: matrixClinic } = await supabase
      .from('clinics')
      .select('name, cnes, cnpj, orgao_emissor')
      .eq('id', matrixId)
      .single();

    if (!matrixClinic) {
      throw new Error('Clínica matriz não encontrada.');
    }

    // Buscar atendimentos de TODAS as unidades do grupo
    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id, attendance_date, quantity, attendance_character, professional_cbo, cid, auth_number, authorization_date,
        service_classifications ( service_code, classification_code ),
        patients!inner ( name, cns_patient, birth_date, gender, ibge_code, race_color, nationality, ethnicity, cep, address_street, address_complement, address_neighborhood, address_number, city, phone ),
        professionals!inner ( name, cns ),
        procedures!inner ( name, code, bpa_type ),
        clinics!inner ( name, cnes, cnpj, orgao_emissor )
      `)
      .in('clinic_id', groupIds)
      .eq('month_year', month_year)
      .eq('status', 'Realizada');

    if (error || !attendances) {
      throw new Error('Erro ao buscar dados para exportação.');
    }

    const validAttendances = (attendances || []).filter((att: any) => att.procedures?.code && att.procedures.code.trim() !== '');

    if (validAttendances.length === 0) {
      throw new Error('Nenhuma produção exportável encontrada para esta competência.');
    }

    // Usa dados da MATRIZ para o cabeçalho (não da clínica individual)
    const clinic = matrixClinic as any;
    const lines: string[] = [];
    
    // Formata competência de MM/YYYY para YYYYMM
    const [month, year] = month_year.split('/');
    const compYYYYMM = `${year}${month.padStart(2, '0')}`;

    // --- Header (Registro 01) - 127 caracteres seguindo padrão PACOMU.ABR ---
    // Sempre usa CNPJ/CNES da MATRIZ
    const headerLine = 
      '01' +                                      // 1-2: Identificador
      '#BPA#' +                                   // 3-7: Fixo
      compYYYYMM +                                // 8-13: Competência AAAAMM
      padLeft(validAttendances.length.toString(), 6) + // 14-19: Quantidade de Registros (consolidado)
      padLeft(clinic.cnes, 12) +                  // 20-31: CNES/Órgão Emissor (MATRIZ)
      padRight(normalizeText(clinic.name), 30) +  // 32-61: Nome do Órgão (MATRIZ)
      'NVM' +                                     // 62-64: Sigla (Nova Versão Magnético)
      padLeft(clinic.cnpj || '', 14) +            // 65-78: CNPJ (MATRIZ)
      padRight('', 42) +                          // 79-120: Reserva
      'MD04.12';                                  // 121-127: Versão Layout
      
    lines.push(headerLine);

    // --- Linhas de Produção ---
    // Ordenar por Profissional + CBO para agrupar boletins
    const sortedAttendances = [...(validAttendances as any[])].sort((a, b) => {
      const keyA = `${a.professionals.cns}-${a.professional_cbo}`;
      const keyB = `${b.professionals.cns}-${b.professional_cbo}`;
      return keyA.localeCompare(keyB);
    });

    let currentFolha = 1;
    let currentSeq = 1;
    let lastKey = '';

    sortedAttendances.forEach((att: any) => {
      const procCode = sanitize(att.procedures.code);
      const key = `${att.professionals.cns}-${att.professional_cbo}`;

      // Se mudou o profissional/CBO, inicia novo boletim (nova folha, seq 1)
      if (lastKey && key !== lastKey) {
        currentFolha++;
        currentSeq = 1;
      }
      lastKey = key;

      if (att.procedures.bpa_type === 'BPA_C') {
        // BPA-C (Consolidado) - Não usa Folha/Seq
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
        const genderCode = att.patients.gender === 'Feminino' ? 'F' : (att.patients.gender === 'Indefinido' ? 'I' : 'M');
        const age = birthDate ? Math.floor((new Date().getTime() - new Date(att.patients.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

        const line = 
          '03' +                                  // 1-2: Identificador Registro
          padLeft(clinic.cnes, 7) +               // 3-9: CNES Unidade
          compYYYYMM +                            // 10-15: Competência AAAAMM
          padLeft(att.professionals.cns, 15) +    // 16-30: CNS Profissional
          padRight(att.professional_cbo, 6) +     // 31-36: CBO
          attDate +                               // 37-44: Data Atendimento (YYYYMMDD)
          padLeft(currentFolha, 3) +              // 45-47: Folha
          padLeft(currentSeq, 2) +                // 48-49: Sequencial
          padLeft(procCode, 10) +                 // 50-59: Procedimento
          padLeft(att.patients.cns_patient, 15) + // 60-74: CNS Paciente
          genderCode +                            // 75: Sexo
          padLeft(att.patients.ibge_code, 6) +    // 76-81: IBGE Município Residência
          padRight(sanitizeCid(att.cid || 'F840'), 4) + // 82-85: CID
          padLeft(age, 3) +                       // 86-88: Idade
          padLeft(att.quantity, 6) +              // 89-94: Quantidade
          padLeft(att.attendance_character || '01', 2) + // 95-96: Caráter Atendimento
          padRight(sanitize(att.auth_number) || '', 13) + // 97-109: Número Autorização (APAC)
          'BPA' +                                 // 110-112: Origem
          padRight(normalizeText(att.patients.name), 30) + // 113-142: Nome Paciente
          birthDate +                             // 143-150: Data Nascimento (YYYYMMDD)
          mapRaceColor(att.patients.race_color) + // 151-152: Raça/Cor
          padLeft(att.patients.ethnicity || '', 4) + // 153-156: Etnia
          padLeft(att.patients.nationality || '010', 3) + // 157-159: Nacionalidade
          padLeft(att.service_classifications?.service_code || '135', 3) + // 160-162: Serviço
          padLeft(att.service_classifications?.classification_code || '002', 3) + // 163-165: Classificação
          padRight('', 8) +                       // 166-173: Equipe Seq
          padRight('', 4) +                       // 174-177: Equipe Area
          padLeft(clinic.cnpj || '', 14) +        // 178-191: CNPJ (MATRIZ — BPA unificado)
          padLeft(sanitize(att.patients.cep), 8) + // 192-199: CEP Paciente
          '081' +                                 // 200-202: Código Logradouro (Default: RUA)
          padRight(normalizeText(att.patients.address_street), 30) + // 203-232: Logradouro (Rua)
          padRight(normalizeText(att.patients.address_complement), 10) + // 233-242: Complemento
          padRight(normalizeText(att.patients.address_number), 5) + // 243-247: Número
          padRight(normalizeText(att.patients.address_neighborhood), 30) + // 248-277: Bairro
          padRight(sanitizePhone(att.patients.phone), 11); // 278-288: Telefone

        lines.push(padRight(line, 350)); 
        
        // Controle de Folha e Sequencial (Max 20 por folha)
        currentSeq++;
        if (currentSeq > 20) {
          currentFolha++;
          currentSeq = 1;
        }
      }
    });

    return lines.join('\r\n'); // DATASUS requer padrão Windows (CRLF)
  }

  /**
   * Sugere o nome do arquivo seguindo o padrão BPA_CNES_AAAAMM.EXT
   * Sempre usa o CNES da MATRIZ.
   */
  static async getSuggestedFilename(clinic_id: string, month_year: string): Promise<string> {
    const supabase = await createClient();
    const { matrixId } = await this.resolveGroupClinicIds(clinic_id);
    
    // Sempre busca CNES da matriz
    const { data: clinic } = await supabase.from('clinics').select('cnes').eq('id', matrixId).single();
    
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
