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
  const r = (race || '').toLowerCase().trim();
  if (r.includes('branc')) return '01';
  if (r.includes('pret')) return '02';
  if (r.includes('pard')) return '03';
  if (r.includes('amarel')) return '04';
  if (r.includes('indig')) return '05';
  return '03'; // Fallback para Parda (03) pois 99 foi abolido pelo Ministério da Saúde (Portaria GM/MS nº 344/2017)
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
        patients!inner ( name, cns_patient, cpf, ibge_code, gender, birth_date, race_color, cep, address_street, address_number, address_neighborhood ),
        professionals!inner ( name, cns ),
        procedures!inner ( name, code, bpa_type ),
        clinics!inner ( cnes, competence_end_day ),
        sessions:attendance_sessions!inner ( id, session_date, status )
      `)
      .in('clinic_id', groupIds)
      .eq('sessions.status', 'Realizada');

    if (error) {
      throw new Error(`Erro ao buscar produções: ${error.message}`);
    }

    const { getCompetenceForDate } = await import('@/utils/competence');

    const validAttendances: any[] = [];
    (attendances || []).forEach((att: any) => {
      if (!att.procedures?.code || att.procedures.code.trim() === '') return;
      const endDay = att.clinics?.competence_end_day || 31;
      const sessions = att.sessions || [];
      const hasMatchingSession = sessions.some((s: any) => s.status === 'Realizada' && getCompetenceForDate(s.session_date, endDay).monthYear === month_year);
      if (hasMatchingSession) {
        validAttendances.push(att);
      }
    });

    const errors: BpaValidationResult['errors'] = [];

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
        if (!att.patients?.cns_patient && !att.patients?.cpf) missing.push('Paciente sem CNS e sem CPF');
        if (!att.patients?.ibge_code) missing.push('Paciente sem Código IBGE');
        if (!att.patients?.birth_date) missing.push('Paciente sem Data de Nascimento');
        if (!att.patients?.cep) missing.push('Paciente sem CEP');
        if (!att.patients?.address_street) missing.push('Paciente sem Logradouro');
        if (!att.patients?.address_neighborhood) missing.push('Paciente sem Bairro');
        if (att.patients?.gender === 'Não Informado') missing.push('Paciente com Sexo não informado');
        if (!att.patients?.race_color || att.patients?.race_color === 'Não Informado') {
          missing.push('Paciente sem Raça/Cor informada (obrigatório pelo SUS - Portaria 344/2017)');
        }
      }

      // Validações Profissional
      if (!att.professionals?.cns) missing.push('Profissional sem CNS');
      if (!att.professional_cbo) missing.push('CBO não identificado para este atendimento');

      // Validações Procedimento
      if (!att.procedures?.code) missing.push('Procedimento sem Código SUS');
      if (att.procedures?.bpa_type === 'NAO_APLICA') missing.push('Procedimento sem Tipo BPA definido (BPA-I/BPA-C)');
      if (att.procedures?.code === '0301010048') {
        if (!att.patients?.cpf && !att.patients?.no_cpf_civil_registry) {
          missing.push('Procedimento 0301010048 exige CPF do paciente (Atributo 058 SIGTAP)');
        }
      }

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

    // Buscar atendimentos e suas sessões realizadas de TODAS as unidades do grupo
    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id, attendance_date, quantity, attendance_character, professional_cbo, cid, auth_number, authorization_date,
        service_classifications ( service_code, classification_code ),
        patients!inner ( name, cns_patient, cpf, birth_date, gender, ibge_code, race_color, nationality, ethnicity, cep, address_street, address_complement, address_neighborhood, address_number, city, phone, is_homeless, no_cpf_civil_registry ),
        professionals!inner ( name, cns ),
        procedures!inner ( 
          name, 
          code, 
          bpa_type,
          procedure_service_classifications (
            service_classifications ( service_code, classification_code )
          )
        ),
        clinics!inner ( name, cnes, cnpj, orgao_emissor, competence_end_day ),
        sessions:attendance_sessions!inner ( id, session_date, status )
      `)
      .in('clinic_id', groupIds)
      .eq('sessions.status', 'Realizada');

    if (error || !attendances) {
      throw new Error(`Erro ao buscar dados para exportação: ${error?.message || ''}`);
    }

    const { getCompetenceForDate } = await import('@/utils/competence');

    // Agrupar atendimentos e sessões pertencentes à competência solicitada
    // Padrão DATASUS BPA-I: 1 linha consolidada por Paciente + Procedimento + Profissional + CBO,
    // contendo a soma das sessões realizadas no período e a data da primeira sessão do ciclo.
    const groupedItemsMap = new Map<string, any>();

    (attendances || []).forEach((att: any) => {
      if (!att.procedures?.code || att.procedures.code.trim() === '') return;
      const endDay = att.clinics?.competence_end_day || 31;
      const sessions = att.sessions || [];

      // Filtrar apenas sessões com status 'Realizada' pertencentes a esta competência
      const matchingSessions = sessions.filter((s: any) => {
        if (s.status !== 'Realizada') return false;
        const comp = getCompetenceForDate(s.session_date, endDay);
        return comp.monthYear === month_year;
      });

      if (matchingSessions.length === 0) return;

      const isBpaC = att.procedures.bpa_type === 'BPA_C';
      const patientKey = sanitize(att.patients?.cns_patient) || sanitize(att.patients?.cpf) || normalizeText(att.patients?.name);
      const procCode = sanitize(att.procedures.code);
      const profCns = sanitize(att.professionals?.cns);
      const cbo = sanitize(att.professional_cbo);

      // Chave de agrupamento:
      // BPA-C: por código de procedimento
      // BPA-I: por Paciente + Procedimento + Profissional + CBO
      const groupKey = isBpaC
        ? `BPA_C_${procCode}`
        : `${patientKey}_${procCode}_${profCns}_${cbo}`;

      // Ordenar datas para identificar a primeira sessão realizada do ciclo
      const sessionDates = matchingSessions
        .map((s: any) => sanitize(s.session_date))
        .filter(Boolean)
        .sort();
      const firstSessionDate = sessionDates[0] || sanitize(att.attendance_date);

      if (groupedItemsMap.has(groupKey)) {
        const existing = groupedItemsMap.get(groupKey);
        existing.quantity += matchingSessions.length;
        if (firstSessionDate && (!existing.session_date || firstSessionDate < existing.session_date)) {
          existing.session_date = firstSessionDate;
        }
      } else {
        groupedItemsMap.set(groupKey, {
          ...att,
          session_date: firstSessionDate,
          quantity: matchingSessions.length
        });
      }
    });

    const exportableItems: any[] = Array.from(groupedItemsMap.values());

    if (exportableItems.length === 0) {
      throw new Error('Nenhuma produção exportável encontrada para esta competência.');
    }

    // Usa dados da MATRIZ para o cabeçalho (não da clínica individual)
    const clinic = matrixClinic as any;
    const lines: string[] = [];
    
    // Formata competência de MM/YYYY para YYYYMM
    const [month, year] = month_year.split('/');
    const compYYYYMM = `${year}${month.padStart(2, '0')}`;

    // --- Ordenar e calcular Folhas/Sequenciais e Checksum ---
    // Ordenar por Profissional + CBO para agrupar boletins
    const sortedItems = [...exportableItems].sort((a, b) => {
      const keyA = `${a.professionals.cns}-${a.professional_cbo}`;
      const keyB = `${b.professionals.cns}-${b.professional_cbo}`;
      return keyA.localeCompare(keyB);
    });

    let currentFolha = 1;
    let currentSeq = 1;
    let lastKey = '';
    let totalProcSum = 0;

    const itemsWithFolha = sortedItems.map((att: any) => {
      const procCode = sanitize(att.procedures.code);
      const key = `${att.professionals.cns}-${att.professional_cbo}`;

      // Se mudou o profissional/CBO, inicia novo boletim (nova folha, seq 1)
      if (lastKey && key !== lastKey) {
        currentFolha++;
        currentSeq = 1;
      }
      lastKey = key;

      const folha = currentFolha;
      const seq = currentSeq;

      // Soma para o campo de controle: código do procedimento + quantidade
      const pNum = parseInt(procCode || '0', 10);
      const qNum = parseInt(att.quantity || '1', 10);
      totalProcSum += (pNum + qNum);

      // Controle de Folha e Sequencial (Max 20 por folha)
      currentSeq++;
      if (currentSeq > 20) {
        currentFolha++;
        currentSeq = 1;
      }

      return {
        ...att,
        folha,
        seq,
        procCode,
      };
    });

    const totalFolhas = currentFolha;
    const totalLines = itemsWithFolha.length + 1; // Itens + Linha 01 de Header
    const controlCode = (totalProcSum % 1111) + 1111; // Fórmula oficial do DATASUS (domínio 1111..2221)

    // --- Header (Registro 01) - 126 caracteres seguindo layout oficial DATASUS Versão 05.00 ---
    const sigla = (clinic.orgao_emissor || clinic.name || 'CLINIC').trim();
    const headerLine = 
      '01' +                                      // 1-2: Identificador
      '#BPA#' +                                   // 3-7: Fixo
      compYYYYMM +                                // 8-13: Competência AAAAMM
      padLeft(totalLines, 6) +                    // 14-19: Total de linhas gravadas no arquivo incluindo header
      padLeft(totalFolhas, 6) +                   // 20-25: Total de folhas gravadas
      padLeft(controlCode, 4) +                   // 26-29: Campo de controle / Dígito verificador
      padRight(normalizeText(clinic.name), 30) +  // 30-59: Nome do Órgão (MATRIZ)
      padRight(normalizeText(sigla), 6) +         // 60-65: Sigla do Órgão
      padLeft(clinic.cnpj || '', 14) +            // 66-79: CNPJ do Órgão/Prestador (MATRIZ)
      padRight('', 40) +                          // 80-119: Nome do Órgão Destino (40 espaços)
      'M' +                                       // 120: Indicador do Órgão Destino (M - Municipal)
      'D05.00';                                   // 121-126: Versão Layout Oficial BPA 05.00
      
    lines.push(headerLine);

    // --- Linhas de Produção ---
    itemsWithFolha.forEach((att: any) => {
      if (att.procedures.bpa_type === 'BPA_C') {
        // BPA-C (Consolidado) - Não usa Folha/Seq
        const line = 
          '02' +                                  // 1-2
          padLeft(clinic.cnes, 7) +               // 3-9
          compYYYYMM +                            // 10-15
          padLeft(att.procCode, 10) +             // 16-25
          padLeft(att.quantity, 6);               // 26-31
        
        lines.push(padRight(line, 351));
      } else {
        // BPA-I (Individualizado) - 351 caracteres fixos conforme layout BPA v05.00
        const attDate = sanitize(att.session_date || att.attendance_date); // YYYYMMDD
        const birthDate = sanitize(att.patients.birth_date); // YYYYMMDD
        const genderCode = att.patients.gender === 'Feminino' ? 'F' : (att.patients.gender === 'Indefinido' ? 'I' : 'M');
        const age = birthDate ? Math.floor((new Date().getTime() - new Date(att.patients.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
        const raceCode = mapRaceColor(att.patients.race_color);
        // Etnia: preencher apenas se raça/cor for 05 (Indígena), senão 4 espaços em branco
        const etniaCode = raceCode === '05' ? padLeft(att.patients.ethnicity || '', 4) : '    ';

        // Identificação por CNS ou CPF (Regra oficial DATASUS: apenas 1 documento por atendimento)
        // Regra Atributo 058: Para procedimentos como 0301010048, o SIGTAP exige estritamente CPF.
        const isAttr058 = att.procCode === '0301010048';
        const cpfDigits = sanitize(att.patients.cpf);
        const hasCpf = !!cpfDigits && cpfDigits.length === 11;
        const hasCns = !!att.patients.cns_patient && att.patients.cns_patient.trim().length > 0;

        let cnsField = padRight('', 15);
        let cpfField = padRight('', 11);

        if (isAttr058 && hasCpf) {
          // Atributo 058: CPF é mandatório no SIGTAP, CNS vai em branco (15 espaços)
          cpfField = padLeft(cpfDigits, 11);
        } else if (hasCns) {
          cnsField = padLeft(att.patients.cns_patient, 15);
        } else if (hasCpf) {
          cpfField = padLeft(cpfDigits, 11);
        }

        // Compatibilização de CID:
        // Se for terapia fonoaudiológica (0301070113) e o CID for F840 ou vazio, compatibilizar com R498 (exigido pelo SIGTAP)
        let cidCode = sanitizeCid(att.cid || 'F840');
        if (att.procCode === '0301070113' && (cidCode === 'F840' || !cidCode)) {
          cidCode = 'R498';
        }

        // Resolução de Serviço e Classificação:
        // 1. Prioridade: Se o atendimento tem serviço/classificação já vinculado diretamente
        let sCode = att.service_classifications?.service_code;
        let cCode = att.service_classifications?.classification_code;

        // 2. Fallback: Se não houver no atendimento, buscar do procedimento vinculado
        if (!sCode || !cCode) {
          const pscList = att.procedures?.procedure_service_classifications;
          if (Array.isArray(pscList) && pscList.length > 0) {
            const firstValid = pscList.find((psc: any) => psc.service_classifications?.service_code);
            if (firstValid?.service_classifications) {
              sCode = firstValid.service_classifications.service_code;
              cCode = firstValid.service_classifications.classification_code;
            }
          }
        }

        // 3. Regra Específica de Reabilitação (TEA/Autismo - Clínica NINA CNES 4252284):
        // Procedimentos ambulatoriais de reabilitação (0301070075, 0301070067, 0301070024, 0301070113)
        // exigem Serviço 135 e Classificação 010 (habilitação oficial de TEA no SIGTAP).
        // Se estiver em branco ou apontando para 002 (Física - não habilitada), assegurar 135/010:
        const isReabTea = ['0301070075', '0301070067', '0301070024', '0301070113'].includes(att.procCode);
        if (isReabTea && (!sCode || !cCode || cCode === '002')) {
          sCode = '135';
          cCode = '010';
        }

        // 4. Se nenhum estiver definido (ou se o procedimento não exige serviço/classificação, ex: 0301010048), enviar 6 espaços em branco
        const srvClfField = (sCode && cCode)
          ? padLeft(sCode, 3) + padLeft(cCode, 3)
          : '      ';

        // Campos novos DATASUS (v04.08 e v05.00)
        const situacaoRua = att.patients.is_homeless ? 'S' : 'N';
        const semCpf = att.patients.no_cpf_civil_registry ? 'S' : 'N';

        const line = 
          '03' +                                  // 1-2: Identificador Registro (2)
          padLeft(clinic.cnes, 7) +               // 3-9: CNES Unidade (7)
          compYYYYMM +                            // 10-15: Competência AAAAMM (6)
          padLeft(att.professionals.cns, 15) +    // 16-30: CNS Profissional (15)
          padRight(att.professional_cbo, 6) +     // 31-36: CBO (6)
          attDate +                               // 37-44: Data Atendimento (YYYYMMDD) (8)
          padLeft(att.folha, 3) +                 // 45-47: Folha (3)
          padLeft(att.seq, 2) +                   // 48-49: Sequencial (2)
          padLeft(att.procCode, 10) +             // 50-59: Procedimento (10)
          cnsField +                              // 60-74: CNS Paciente (15)
          genderCode +                            // 75: Sexo (1)
          padLeft(att.patients.ibge_code, 6) +    // 76-81: IBGE Município Residência (6)
          padRight(cidCode, 4) +                  // 82-85: CID (4)
          padLeft(age, 3) +                       // 86-88: Idade (3)
          padLeft(att.quantity, 6) +              // 89-94: Quantidade (6)
          padLeft(att.attendance_character || '01', 2) + // 95-96: Caráter Atendimento (2)
          padRight(sanitize(att.auth_number) || '', 13) + // 97-109: Número Autorização APAC (13)
          'BPA' +                                 // 110-112: Origem (3)
          padRight(normalizeText(att.patients.name), 30) + // 113-142: Nome Paciente (30)
          birthDate +                             // 143-150: Data Nascimento YYYYMMDD (8)
          raceCode +                              // 151-152: Raça/Cor (01..05) (2)
          etniaCode +                             // 153-156: Etnia (4)
          padLeft(att.patients.nationality || '010', 3) + // 157-159: Nacionalidade (3)
          srvClfField +                           // 160-165: Serviço (3) + Classificação (3) ou 6 espaços
          padRight('', 8) +                       // 166-173: Equipe Seq (8)
          padRight('', 4) +                       // 174-177: Equipe Area (4)
          padRight('', 14) +                      // 178-191: CNPJ Empresa OPM (14 espaços para atendimentos normais) (14)
          padLeft(sanitize(att.patients.cep), 8) + // 192-199: CEP Paciente (8)
          '081' +                                 // 200-202: Código Logradouro Default RUA (3)
          padRight(normalizeText(att.patients.address_street), 30) + // 203-232: Logradouro (30)
          padRight(normalizeText(att.patients.address_complement), 10) + // 233-242: Complemento (10)
          padRight(normalizeText(att.patients.address_number || 'S/N'), 5) + // 243-247: Número (5)
          padRight(normalizeText(att.patients.address_neighborhood), 30) + // 248-277: Bairro (30)
          padRight(sanitizePhone(att.patients.phone), 11) + // 278-288: Telefone (11)
          padRight('', 40) +                      // 289-328: E-mail (40)
          padRight('', 10) +                      // 329-338: INE Equipe (10)
          cpfField +                              // 339-349: CPF Paciente (11)
          situacaoRua +                           // 350: Pessoa em Situação de Rua PNRV (1)
          semCpf;                                 // 351: Pessoa sem CPF/Registro Civil v05.00 (1)

        lines.push(padRight(line, 351));
      }
    });

    return lines.join('\r\n'); // DATASUS requer padrão Windows (CRLF)
  }

  /**
   * Sugere o nome do arquivo seguindo o padrão BPA_<CNES>.<EXT> (8.3 compatível com BPA Magnético)
   * Sempre usa o CNES da MATRIZ.
   */
  static async getSuggestedFilename(clinic_id: string, month_year: string): Promise<string> {
    const supabase = await createClient();
    const { matrixId } = await this.resolveGroupClinicIds(clinic_id);
    
    // Sempre busca CNES da matriz
    const { data: clinic } = await supabase.from('clinics').select('cnes').eq('id', matrixId).single();
    
    const [month] = month_year.split('/');
    const cnes = clinic?.cnes || '0000000';

    const extensions: Record<string, string> = {
      '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR',
      '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO',
      '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ'
    };

    const ext = extensions[month.padStart(2, '0')] || 'TXT';
    return `BPA_${cnes}.${ext}`;
  }
}
