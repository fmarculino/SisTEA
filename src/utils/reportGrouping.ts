/**
 * Utilitário para agrupamento hierárquico de produções: Profissional ➔ Paciente ➔ Sessões
 */

export interface GroupedSessionItem {
  session_date: string
  procedure_code?: string
  procedure_name?: string
  status: string
  valor_sus: number
  valor_rp: number
  value: number
  auth_number?: string
}

export interface GroupedPatientItem {
  key: string
  patient_name: string
  patient_cns: string
  auth_number: string
  sessions: GroupedSessionItem[]
  total_sus: number
  total_rp: number
  total_value: number
  total_sessions: number
}

export interface GroupedProfessionalItem {
  key: string
  professional_name: string
  professional_cns: string
  professional_cbo: string
  clinic_name?: string
  patients: GroupedPatientItem[]
  total_patients: number
  total_sessions: number
  total_sus: number
  total_rp: number
  total_value: number
}

export interface GroupedBillingReportData {
  professionals: GroupedProfessionalItem[]
  overall: {
    total_professionals: number
    total_patients: number
    total_sessions: number
    total_sus: number
    total_rp: number
    total_value: number
  }
}

export function groupBillingData(data: any[]): GroupedBillingReportData {
  const profMap = new Map<string, {
    key: string
    professional_name: string
    professional_cns: string
    professional_cbo: string
    clinic_name?: string
    patientMap: Map<string, GroupedPatientItem>
    total_sessions: number
    total_sus: number
    total_rp: number
    total_value: number
  }>()

  let overallSus = 0
  let overallRp = 0
  let overallTotal = 0
  let overallSessions = 0
  const uniquePatientsOverall = new Set<string>()

  data.forEach((row) => {
    const profName = row.professional_name || 'Profissional Não Informado'
    const profCns = row.professional_cns || ''
    const profCbo = row.professional_cbo || ''
    const profKey = `${profName}_${profCns}_${profCbo}`

    const patName = row.patient_name || 'Paciente Não Informado'
    const patCns = row.patient_cns || ''
    const authNumber = row.auth_number || 'SEM AUTORIZAÇÃO'
    const patKey = `${patName}_${patCns}_${authNumber}`

    if (!profMap.has(profKey)) {
      profMap.set(profKey, {
        key: profKey,
        professional_name: profName,
        professional_cns: profCns || 'SEM CNS',
        professional_cbo: profCbo || 'SEM CBO',
        clinic_name: row.clinic_name,
        patientMap: new Map(),
        total_sessions: 0,
        total_sus: 0,
        total_rp: 0,
        total_value: 0
      })
    }

    const prof = profMap.get(profKey)!

    if (!prof.patientMap.has(patKey)) {
      prof.patientMap.set(patKey, {
        key: patKey,
        patient_name: patName,
        patient_cns: patCns || 'SEM CNS',
        auth_number: authNumber,
        sessions: [],
        total_sus: 0,
        total_rp: 0,
        total_value: 0,
        total_sessions: 0
      })
    }

    const patient = prof.patientMap.get(patKey)!
    const valSus = Number(row.valor_sus) || 0
    const valRp = Number(row.valor_rp) || 0
    const valTotal = Number(row.value) || 0

    patient.sessions.push({
      session_date: row.session_date,
      procedure_code: row.procedure_code,
      procedure_name: row.procedure_name,
      status: row.status,
      valor_sus: valSus,
      valor_rp: valRp,
      value: valTotal,
      auth_number: row.auth_number
    })

    patient.total_sus += valSus
    patient.total_rp += valRp
    patient.total_value += valTotal
    patient.total_sessions += 1

    prof.total_sus += valSus
    prof.total_rp += valRp
    prof.total_value += valTotal
    prof.total_sessions += 1

    overallSus += valSus
    overallRp += valRp
    overallTotal += valTotal
    overallSessions += 1
    uniquePatientsOverall.add(`${patName}_${patCns}`)
  })

  // Converter Maps para Arrays ordenados
  const professionals: GroupedProfessionalItem[] = Array.from(profMap.values())
    .map((prof) => {
      const patients = Array.from(prof.patientMap.values()).map((pat) => {
        // Ordenar sessões cronologicamente
        pat.sessions.sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
        return pat
      })
      // Ordenar pacientes alfabeticamente
      patients.sort((a, b) => a.patient_name.localeCompare(b.patient_name))

      return {
        key: prof.key,
        professional_name: prof.professional_name,
        professional_cns: prof.professional_cns,
        professional_cbo: prof.professional_cbo,
        clinic_name: prof.clinic_name,
        patients,
        total_patients: patients.length,
        total_sessions: prof.total_sessions,
        total_sus: prof.total_sus,
        total_rp: prof.total_rp,
        total_value: prof.total_value
      }
    })

  // Ordenar profissionais alfabeticamente
  professionals.sort((a, b) => a.professional_name.localeCompare(b.professional_name))

  return {
    professionals,
    overall: {
      total_professionals: professionals.length,
      total_patients: uniquePatientsOverall.size,
      total_sessions: overallSessions,
      total_sus: overallSus,
      total_rp: overallRp,
      total_value: overallTotal
    }
  }
}
