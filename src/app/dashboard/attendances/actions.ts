'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { attendanceSchema, type AttendanceFormData } from './schema'
import { logAudit } from '@/lib/audit'
import { buildValidationURL, generateValidationHMAC, isLinkExpired, verifyValidationHMAC } from '@/utils/token'
import { headers } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'

async function validateProcedureQuantityLimit(
  supabase: any,
  attendanceId: string | null,
  patientId: string,
  professionalId: string,
  procedureId: string,
  attendanceDate: string,
  incomingSessionsCount: number
) {
  const { data: procedure } = await supabase
    .from('procedures')
    .select('max_quantity')
    .eq('id', procedureId)
    .single()

  if (!procedure || !procedure.max_quantity) return null

  const [year, month] = attendanceDate.split('-')
  const monthYear = `${month}/${year}`

  // Count existing sessions in other attendances for this professional/patient/procedure in the same month
  const { count, error } = await supabase
    .from('attendance_sessions')
    .select('id, attendances!inner(patient_id, professional_id, procedure_id, month_year)', { count: 'exact', head: true })
    .eq('attendances.patient_id', patientId)
    .eq('attendances.professional_id', professionalId)
    .eq('attendances.procedure_id', procedureId)
    .eq('attendances.month_year', monthYear)
    .neq('attendance_id', attendanceId || '00000000-0000-0000-0000-000000000000')

  if (error) return { error: `Erro ao validar limite de quantidade: ${error.message}` }

  const total = (count || 0) + incomingSessionsCount
  if (total > procedure.max_quantity) {
    return {
      error: `Limite de sessões atingido para este procedimento (${procedure.max_quantity}). Você está tentando lançar ${incomingSessionsCount} frequência(s), mas já existem ${count} frequência(s) registradas para este profissional/paciente nesta competência (${monthYear}).`
    }
  }

  return null
}

export async function checkCompetenceLock(supabase: any, clinic_id: string, attendance_date: string) {
  const { data: clinicConfig } = await supabase.from('clinics').select('competence_end_day').eq('id', clinic_id).single()
  const endDay = clinicConfig?.competence_end_day || 31

  const dateParts = attendance_date.split('-')
  const day = parseInt(dateParts[2], 10)
  let month = parseInt(dateParts[1], 10)
  let year = parseInt(dateParts[0], 10)

  if (day > endDay && endDay < 31) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  const { data: competence } = await supabase
    .from('competences')
    .select('status')
    .eq('clinic_id', clinic_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (competence?.status === 'ENVIADA_MS') {
    return { error: 'HARD LOCK: A competência desta data foi enviada ao Ministério da Saúde. Nenhuma alteração é permitida sob nenhuma circunstância.' }
  }
  if (competence?.status === 'FECHADA') {
    return { error: 'A competência para a data informada está encerrada e não permite alterações. Solicite a reabertura ao administrador.' }
  }
  return null
}

export async function createAttendanceAction(data: AttendanceFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || 'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

  // --- SECURITY: Conflict Check (BR-001, BR-002, BR-003) ---
  if (sessions && sessions.length > 0) {
    const conflictError = await validateSessionsAction(
      supabase,
      null,
      rawAttendanceData.patient_id,
      rawAttendanceData.professional_id,
      sessions
    )
    if (conflictError) return conflictError
  }

  // --- SECURITY: Future Date Check (Date-only comparison) ---
  const { data: settings } = await supabase.from('system_settings').select('key, value').in('key', ['allow_future_attendances', 'system_timezone'])
  const settingsMap = new Map(settings?.map(s => [s.key, s.value]))
  const allowFuture = settingsMap.get('allow_future_attendances') === undefined ? true : (settingsMap.get('allow_future_attendances') === true || settingsMap.get('allow_future_attendances') === 'true')
  const systemTimezone = settingsMap.get('system_timezone') || 'America/Sao_Paulo'

  if (!allowFuture) {
    const now = new Date()
    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(now) // YYYY-MM-DD

    // Check main attendance date
    if (rawAttendanceData.attendance_date > todayLocal) {
      return { error: 'O sistema está configurado para não permitir o registro de atendimentos com data futura.' }
    }

    // Check sessions
    if (sessions) {
      const hasFuture = sessions.some(s => s.session_date > todayLocal)
      if (hasFuture) return { error: 'O sistema está configurado para não permitir o registro de frequências com data futura.' }
    }
  }

  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, rawAttendanceData.clinic_id, rawAttendanceData.attendance_date)
  if (compError) return compError

  // --- CLINIC GROUP ACCESS CHECK ---
  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')
  if (isClinicRole) {
    const hasAccess = profile?.linked_clinics?.some((c: any) => c.clinic_id === rawAttendanceData.clinic_id)
    if (!hasAccess) {
      return { error: 'Você não tem permissão para criar atendimentos nesta clínica.' }
    }
  }

  // --- QUANTITY LIMIT CHECK (BR-004) ---
  const qtyLimitError = await validateProcedureQuantityLimit(
    supabase,
    null,
    rawAttendanceData.patient_id,
    rawAttendanceData.professional_id,
    rawAttendanceData.procedure_id,
    rawAttendanceData.attendance_date,
    sessions?.length || 0
  )
  if (qtyLimitError) return qtyLimitError

  // --- FETCH PROCEDURE VALUE (Historical Contract Snapshot) ---
  const { data: contractPrice } = await supabase
    .from('clinic_procedure_prices')
    .select('valor_total')
    .eq('clinic_id', rawAttendanceData.clinic_id)
    .eq('procedure_id', rawAttendanceData.procedure_id)
    .eq('active', true)
    .lte('valid_from', rawAttendanceData.attendance_date)
    .or(`valid_to.is.null,valid_to.gte.${rawAttendanceData.attendance_date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contractPrice && !rawAttendanceData.is_historical_import) {
    return {
      error: 'Bloqueio Contratual: A clínica selecionada não possui contrato ativo/vigente para executar este procedimento na data informada.'
    }
  }

  let baseValue = 0
  if (contractPrice) {
    baseValue = Number(contractPrice.valor_total)
  } else {
    // Fallback to global procedure price if no specific contract is found (historical only)
    const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
    baseValue = Number(proc?.valor_total) || 0
  }

  const realizedSessions = sessions?.filter(s => s.status === 'Realizada').length || 0
  const finalValue = realizedSessions * baseValue

  const [year, month] = rawAttendanceData.attendance_date.split('-')
  const month_year = `${month}/${year}`

  const attendanceData = {
    ...rawAttendanceData,
    value_applied: finalValue,
    authorization_date: rawAttendanceData.authorization_date || null,
    month_year,
  }

  const { data: attendance, error } = await supabase.from('attendances').insert({
    ...attendanceData,
    status: realizedSessions > 0 ? 'Realizada' : 'Pendente'
  }).select().single()

  if (error) return { error: error.message }

  if (sessions && sessions.length > 0) {
    const sessionsToInsert = sessions.map(session => {
      let auditData = {
        validated_at: session.validated_at,
        validation_ip: session.validation_ip,
        validation_ua: session.validation_ua,
        action_by_login: session.action_by_login,
        validation_type: session.validation_type,
      }

      if (profile?.role === 'SMS_ADMIN' && (session.status === 'Realizada' || session.status === 'Glosado' || session.status === 'Pendente')) {
        auditData = {
          validated_at: new Date().toISOString(),
          validation_ip: ip,
          validation_ua: userAgent,
          action_by_login: profile.email || 'admin',
          validation_type: session.status === 'Glosado' ? 'GLOSA' : session.status === 'Pendente' ? 'PENDENCIA' : 'MANUAL_AUTH'
        }
      }

      return {
        attendance_id: attendance.id,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        justification: session.justification,
        ...auditData
      }
    })

    const { error: sessionError } = await supabase.from('attendance_sessions').insert(sessionsToInsert)
    if (sessionError) return { error: `Erro ao salvar sessões: ${sessionError.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')

  // Log audit
  await logAudit({
    action: 'CREATE',
    table_name: 'attendances',
    record_id: attendance.id,
    new_data: attendance,
    description: `Cadastrou novo atendimento/guia para o paciente ID: ${rawAttendanceData.patient_id}.`
  })

  return { success: true, id: attendance.id }
}

export async function updateAttendanceAction(id: string, data: AttendanceFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || 'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // --- SECURITY: Conflict Check (BR-001, BR-002, BR-003) ---
  if (sessions && sessions.length > 0) {
    const conflictError = await validateSessionsAction(
      supabase,
      id,
      rawAttendanceData.patient_id,
      rawAttendanceData.professional_id,
      sessions
    )
    if (conflictError) return conflictError
  }

  // --- SECURITY: Future Date Check (Date-only comparison) ---
  const { data: settings } = await supabase.from('system_settings').select('key, value').in('key', ['allow_future_attendances', 'system_timezone'])
  const settingsMap = new Map(settings?.map(s => [s.key, s.value]))
  const allowFuture = settingsMap.get('allow_future_attendances') === undefined ? true : (settingsMap.get('allow_future_attendances') === true || settingsMap.get('allow_future_attendances') === 'true')
  const systemTimezone = settingsMap.get('system_timezone') || 'America/Sao_Paulo'

  if (!allowFuture) {
    const now = new Date()
    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(now) // YYYY-MM-DD

    // Check main attendance date
    if (rawAttendanceData.attendance_date > todayLocal) {
      return { error: 'O sistema está configurado para não permitir o registro de atendimentos com data futura.' }
    }

    // Check sessions
    if (sessions) {
      const hasFuture = sessions.some(s => s.session_date > todayLocal)
      if (hasFuture) return { error: 'O sistema está configurado para não permitir o registro de frequências com data futura.' }
    }
  }

  // --- SECURITY: Fetch current state to prevent tampering after validation ---
  const { data: currentAttendance } = await supabase
    .from('attendances')
    .select('*, sessions:attendance_sessions(*)')
    .eq('id', id)
    .single()

  if (!currentAttendance) return { error: 'Atendimento não encontrado' }

  // --- CLINIC GROUP ACCESS CHECK ---
  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')
  if (isClinicRole) {
    const hasCurrentAccess = profile?.linked_clinics?.some((c: any) => c.clinic_id === currentAttendance.clinic_id)
    const hasNewAccess = profile?.linked_clinics?.some((c: any) => c.clinic_id === rawAttendanceData.clinic_id)
    if (!hasCurrentAccess || !hasNewAccess) {
      return { error: 'Você não tem permissão para editar atendimentos desta clínica.' }
    }
  }

  const dbSessions = (currentAttendance as any).sessions as any[] || []
  const hasValidatedInDb = dbSessions.some((s: any) => s.status === 'Realizada' || s.status === 'Glosado' || s.status === 'Faltou')

  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && hasValidatedInDb) {
    // If ANY session is validated, critical header fields become IMMUTABLE
    const patientChanged = rawAttendanceData.patient_id !== currentAttendance.patient_id
    const professionalChanged = rawAttendanceData.professional_id !== currentAttendance.professional_id
    const procedureChanged = rawAttendanceData.procedure_id !== currentAttendance.procedure_id
    const dateChanged = rawAttendanceData.attendance_date !== currentAttendance.attendance_date

    if (patientChanged || professionalChanged || procedureChanged || dateChanged) {
      return {
        error: 'Não é possível alterar o Paciente, Profissional, Procedimento ou Data de Competência após uma sessão ter sido realizada, glosada ou registrada como "Faltou".'
      }
    }
  }

  // --- SECURITY: Session deletion check ---
  if (sessions) {
    const incomingIds = new Set(sessions.map(s => s.id).filter(Boolean));

    for (const s of dbSessions) {
      if (!incomingIds.has(s.id)) {
        // Rule 1: Clinic User can only delete sessions that are "Pendente" or "Não Realizado" and NOT validated
        if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && ((s.status !== 'Pendente' && s.status !== 'Não Realizado') || s.validated_at)) {
          return { error: 'Clínicas não têm permissão para remover frequências que já foram realizadas, validadas ou registradas como "Faltou".' };
        }
        // Rule 2: Admin cannot delete a session validated by patient (digital signature)
        if (profile?.role === 'SMS_ADMIN' && s.validated_at) {
          return { error: 'Não é possível excluir uma frequência que já foi validada pelo paciente via QR Code. Você pode alterar seu status para "Glosado" ou "Pendente", mas a frequência deve ser mantida para fins de auditoria.' };
        }
      }
    }
  }

  // --- SECURITY: Check session status consistency ---
  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && sessions) {
    const existingSessionsMap = new Map<string, any>((dbSessions || []).map((s: any) => [s.id, s]))

    // 1. Block reverting or modifying a session that was originally marked as Faltou
    for (const session of sessions) {
      if (session.id) {
        const existing = existingSessionsMap.get(session.id)
        if (existing?.status === 'Faltou' && session.status !== 'Faltou') {
          return { error: 'Não é possível alterar o status de uma frequência que já foi registrada como "Faltou".' }
        }
        if (existing?.status === 'Faltou') {
          const dateModified = session.session_date !== existing.session_date
          const startModified = session.start_time !== existing.start_time
          const endModified = session.end_time !== existing.end_time
          if (dateModified || startModified || endModified) {
            return { error: 'Não é possível alterar a data ou horários de uma frequência que já foi registrada como "Faltou".' }
          }
        }
      }
    }

    const hasRealizada = sessions.some(s => s.status === 'Realizada')
    if (hasRealizada || hasValidatedInDb) {
      // Any "Realizada" session that wasn't previously validated = fraud attempt
      for (const session of sessions) {
        if (session.id) {
          const existing = existingSessionsMap.get(session.id)
          if (existing?.validated_at && session.status !== existing.status) {
            return { error: 'Não é possível alterar o status de uma sessão que já foi realizada/validada.' }
          }
        }

        if (session.status === 'Realizada' && session.id) {
          const existing = existingSessionsMap.get(session.id)

          // 1. Check if it was already validated
          if (!existing?.validated_at) {
            return { error: 'Sessões só podem ser marcadas como "Realizada" através da validação por QR Code.' }
          }

          // 2. Check if date/time was modified
          const dateModified = session.session_date !== existing.session_date
          const startModified = session.start_time !== existing.start_time
          const endModified = session.end_time !== existing.end_time

          if (dateModified || startModified || endModified) {
            return { error: 'Não é possível alterar a data ou horários de uma sessão que já foi realizada/validada.' }
          }
        }

        if (session.status === 'Realizada' && !session.id) {
          return { error: 'Novas sessões devem ter status "Pendente". Use o QR Code para validar.' }
        }
      }
    }
  }

  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, rawAttendanceData.clinic_id, rawAttendanceData.attendance_date)
  if (compError) return compError

  // --- QUANTITY LIMIT CHECK (BR-004) ---
  const qtyLimitError = await validateProcedureQuantityLimit(
    supabase,
    id,
    rawAttendanceData.patient_id,
    rawAttendanceData.professional_id,
    rawAttendanceData.procedure_id,
    rawAttendanceData.attendance_date,
    sessions?.length || 0
  )
  if (qtyLimitError) return qtyLimitError

  // --- FETCH PROCEDURE VALUE (Historical Contract Snapshot) ---
  const { data: contractPrice } = await supabase
    .from('clinic_procedure_prices')
    .select('valor_total')
    .eq('clinic_id', rawAttendanceData.clinic_id)
    .eq('procedure_id', rawAttendanceData.procedure_id)
    .eq('active', true)
    .lte('valid_from', rawAttendanceData.attendance_date)
    .or(`valid_to.is.null,valid_to.gte.${rawAttendanceData.attendance_date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contractPrice && !rawAttendanceData.is_historical_import) {
    return {
      error: 'Bloqueio Contratual: A clínica selecionada não possui contrato ativo/vigente para executar este procedimento na data informada.'
    }
  }

  let baseValue = 0
  if (contractPrice) {
    baseValue = Number(contractPrice.valor_total)
  } else {
    // Fallback to global procedure price if no specific contract is found (historical only)
    const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
    baseValue = Number(proc?.valor_total) || 0
  }

  const realizedSessions = sessions?.filter(s => s.status === 'Realizada').length || 0
  const finalValue = realizedSessions * baseValue

  const [year, month] = rawAttendanceData.attendance_date.split('-')
  const month_year = `${month}/${year}`

  const attendanceData = {
    ...rawAttendanceData,
    value_applied: finalValue,
    authorization_date: rawAttendanceData.authorization_date || null,
    status: realizedSessions > 0 ? 'Realizada' : 'Pendente',
    month_year,
  }

  const { error } = await supabase.from('attendances').update({
    ...attendanceData,
  }).eq('id', id)

  if (error) return { error: error.message }

  // --- SESSION MANAGEMENT ---
  // Identify sessions that should be preserved (already validated)
  // SMS_ADMIN can override this if they are resetting a session to "Pendente"
  const sessionsToKeepIds = (dbSessions || [])
    .filter((s: any) => {
      if (profile?.role === 'SMS_ADMIN') {
        const incoming = sessions?.find(is => is.id === s.id)
        // If admin modifies status or justification to Pendente, Glosado, or Realizada, 
        // we DON'T keep the old validated version so it can be updated.
        // We block reverting to 'Não Realizado' to enforce immutability of signed sessions.
        if (incoming && (incoming.status !== s.status || incoming.justification !== s.justification)) {
          if (['Pendente', 'Glosado', 'Realizada', 'Não Realizado', 'Faltou'].includes(incoming.status)) {
            return false
          }
        }
      }
      return !!s.validated_at
    })
    .map((s: any) => s.id)

  // Delete all sessions except those we are explicitly keeping
  if (sessionsToKeepIds.length > 0) {
    await supabase
      .from('attendance_sessions')
      .delete()
      .eq('attendance_id', id)
      .not('id', 'in', `(${sessionsToKeepIds.join(',')})`)
  } else {
    await supabase.from('attendance_sessions').delete().eq('attendance_id', id)
  }

  // Re-insert only sessions that are not already in the "preserved" list
  if (sessions && sessions.length > 0) {
    const newSessionsToInsert = sessions
      .filter(session => !session.id || !sessionsToKeepIds.includes(session.id))
      .map(session => {
        let auditData = {
          validated_at: session.validated_at,
          validation_ip: session.validation_ip,
          validation_ua: session.validation_ua,
          action_by_login: session.action_by_login,
          validation_type: session.validation_type,
        }

        if (profile?.role === 'SMS_ADMIN' && (session.status === 'Realizada' || session.status === 'Glosado' || session.status === 'Pendente')) {
          // If the session is an untouched digital signature (QR_CODE) and stays Realizada, keep old audit data
          const isUntouchedDigital = session.validation_type === 'QR_CODE' && session.status === 'Realizada';
          if (!isUntouchedDigital) {
            auditData = {
              validated_at: new Date().toISOString(),
              validation_ip: ip,
              validation_ua: userAgent,
              action_by_login: profile.email || 'admin',
              validation_type: session.status === 'Glosado' ? 'GLOSA' : session.status === 'Pendente' ? 'PENDENCIA' : 'MANUAL_AUTH'
            }
          }
        }

        return {
          attendance_id: id,
          session_date: session.session_date,
          start_time: session.start_time,
          end_time: session.end_time,
          status: session.status,
          justification: session.justification,
          ...auditData
        }
      })

    if (newSessionsToInsert.length > 0) {
      const { error: sessionError } = await supabase.from('attendance_sessions').insert(newSessionsToInsert)
      if (sessionError) return { error: `Erro ao salvar sessões: ${sessionError.message}` }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
  revalidatePath(`/dashboard/attendances/${id}/edit`)

  // --- AUDIT LOGGING ---
  let auditDescription = `Atualizou atendimento/guia ID: ${id}.`
  if (profile?.role === 'SMS_ADMIN') {
    const changedStatuses = sessions?.filter(s => {
      const old = dbSessions.find((os: any) => os.id === s.id)
      return old && old.status !== s.status
    })

    const deletedSessions = dbSessions.filter((os: any) => !sessions?.some(s => s.id === os.id))
    const addedSessions = sessions?.filter(s => !s.id)

    if (changedStatuses?.length || deletedSessions.length || addedSessions?.length) {
      auditDescription = `Administrador alterou frequências no atendimento ID: ${id}. `
      if (changedStatuses?.length) auditDescription += `${changedStatuses.length} status alterados. `
      if (deletedSessions.length) auditDescription += `${deletedSessions.length} sessões removidas. `
      if (addedSessions?.length) auditDescription += `${addedSessions.length} sessões adicionadas.`
    }
  }

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'attendances',
    record_id: id,
    old_data: currentAttendance,
    new_data: { ...rawAttendanceData, sessions },
    description: auditDescription
  })

  return { success: true }
}

export async function deleteAttendanceAction(id: string) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  // --- GET EXISTING ATTENDANCE FOR COMPETENCE CHECK ---
  const { data: attendance } = await supabase
    .from('attendances')
    .select('attendance_date, clinic_id, sessions:attendance_sessions(id, status)')
    .eq('id', id)
    .single()

  if (!attendance) return { error: 'Atendimento não encontrado' }

  // --- SECURITY: Deletion rules ---
  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')) {
    const hasAccess = profile?.linked_clinics?.some((c: any) => c.clinic_id === attendance.clinic_id)
    if (!hasAccess) {
      return { error: 'Você não tem permissão para excluir atendimentos desta clínica.' }
    }
    const sessions = (attendance as any).sessions || []
    if (sessions.length > 0) {
      return { error: 'Clínicas não têm permissão para excluir atendimentos que já possuem frequências registradas. Caso necessário, entre em contato com a administração.' }
    }
  }

  if (profile?.role === 'SMS_ADMIN') {
    const sessions = (attendance as any).sessions || []
    if (sessions.length > 0) {
      return { error: 'Não é possível excluir um atendimento que já possui frequências registradas. Remova as frequências individualmente se necessário ou glose o atendimento.' }
    }
  }

  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, attendance.clinic_id, attendance.attendance_date)
  if (compError) return compError

  const { error } = await supabase.from('attendances').delete().eq('id', id)
  if (error) return { error: error.message }

  // Log audit
  await logAudit({
    action: 'DELETE',
    table_name: 'attendances',
    record_id: id,
    old_data: attendance,
    description: `Excluiu atendimento ID: ${id} do paciente em ${attendance.attendance_date}.`
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
}

/**
 * Generates a signed validation URL for a specific session within an attendance.
 * Called by the QRCodeModal when a clinic user clicks "Solicitar Assinatura".
 */
export async function generateValidationLinkAction(attendanceId: string, sessionId: string) {
  const supabase = await createClient()

  // Get the attendance and its sessions
  const { data: attendance } = await supabase
    .from('attendances')
    .select('id, patient_id, sessions:attendance_sessions(id, session_date, status, validated_at)')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'Atendimento não encontrado' }

  // Find the specific session
  const session = (attendance as any).sessions?.find((s: any) => s.id === sessionId)

  if (!session) return { error: 'Sessão não encontrada' }

  if (session.validated_at) {
    return { error: 'Esta sessão já foi validada' }
  }

  if (session.status === 'Realizada') {
    return { error: 'Esta sessão já está com status Realizada' }
  }

  // --- VALIDATION: Settings Check ---
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['allow_future_attendances', 'signature_window_hours', 'system_timezone', 'system_timezone_offset'])

  const settingsMap = new Map(settings?.map(s => [s.key, s.value]))
  const allowFuture = settingsMap.get('allow_future_attendances') === undefined ? true : (settingsMap.get('allow_future_attendances') === true || settingsMap.get('allow_future_attendances') === 'true')
  const windowHours = Number(settingsMap.get('signature_window_hours')) || 2
  const systemTimezone = settingsMap.get('system_timezone') || 'America/Sao_Paulo'
  const timezoneOffset = settingsMap.get('system_timezone_offset') || '-03:00'

  // --- VALIDATION: Future Date Check ---
  const now = new Date()
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(now)
  const todayEnd = new Date(`${todayLocal}T23:59:59.999${timezoneOffset}`)
  const sessionDate = new Date(session.session_date + `T00:00:00${timezoneOffset}`)

  if (!allowFuture && sessionDate > todayEnd) {
    return { error: 'O registro de frequências futuras não é permitido pelas configurações do sistema.' }
  }

  // --- VALIDATION: SIGNATURE WINDOW CHECK ---
  // Re-fetch with start_time if needed, or update the select above
  const { data: sessionWithTime } = await supabase
    .from('attendance_sessions')
    .select('start_time')
    .eq('id', sessionId)
    .single()

  if (sessionWithTime?.start_time) {
    const scheduledDateTime = new Date(`${session.session_date}T${sessionWithTime.start_time}${timezoneOffset}`)
    const diffMs = now.getTime() - scheduledDateTime.getTime()
    const diffHours = Math.abs(diffMs / (1000 * 60 * 60))

    if (diffHours > windowHours) {
      return {
        error: `Assinatura negada. O horário atual está fora da janela permitida (${windowHours}h) para o atendimento marcado às ${sessionWithTime.start_time.substring(0, 5)}.`
      }
    }
  }

  // 360. Generate a nonce for this validation attempt
  const timestamp = Date.now()
  const hmac = generateValidationHMAC(session.id, timestamp)

  // Store the nonce in the session record
  await supabase
    .from('attendance_sessions')
    .update({
      validation_nonce: hmac, // Store the HMAC as nonce for extra security
      validation_attempts: 0
    })
    .eq('id', session.id)

  // Get the base URL from headers
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const baseUrl = `${protocol}://${host}`

  const url = `${baseUrl}/validar/${session.id}?h=${hmac}&t=${timestamp}`

  // Log audit
  await logAudit({
    action: 'ACCESS',
    table_name: 'attendance_sessions',
    record_id: sessionId,
    description: `Solicitou geração de assinatura (QR Code) para a sessão ID: ${sessionId} do atendimento ID: ${attendanceId}.`
  })

  return { url }
}

/**
 * Validates a session using the provided token, HMAC and timestamp.
 * Replaces the API route for better reliability and integrated error handling.
 */
export async function validateSessionAction(data: {
  sessionId: string
  token: string
  hmac: string
  timestamp: number
  geo?: { lat: number; lng: number; accuracy: number } | null
  validateAllToday?: boolean
}) {
  const { sessionId, token, hmac, timestamp, geo, validateAllToday } = data

  if (!sessionId || !token || !hmac || !timestamp) {
    return { error: 'Dados incompletos' }
  }

  // 1. Verify HMAC signature
  if (!verifyValidationHMAC(sessionId, timestamp, hmac)) {
    return { error: 'Link inválido ou adulterado' }
  }

  // 2. Check expiration (10 minutes for more tolerance)
  if (isLinkExpired(timestamp, 10 * 60 * 1000)) {
    return { error: 'Link expirado. Solicite um novo QR Code.' }
  }

  const supabase = createAdminClient()

  // 3. Get the session
  const { data: session, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select('id, status, validated_at, validation_attempts, attendance_id, validation_nonce, session_date, start_time')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { error: 'Sessão não encontrada' }
  }

  if (session.validated_at) {
    return { error: 'Esta sessão já foi validada anteriormente.' }
  }

  // Verify that this is the latest generated link
  if (session.validation_nonce && session.validation_nonce !== hmac) {
    return { error: 'Este link foi invalidado por uma solicitação mais recente. Use o novo QR Code.' }
  }

  // 4. Check rate limit
  const MAX_ATTEMPTS = 5
  if (session.validation_attempts >= MAX_ATTEMPTS) {
    return {
      error: 'Número máximo de tentativas excedido. Solicite um novo QR Code.',
      blocked: true
    }
  }

  // 5. Get the attendance
  const { data: attendance } = await supabase
    .from('attendances')
    .select(`
      *,
      patient:patients(id, name, auth_token),
      clinic:clinics(id, name, latitude, longitude)
    `)
    .eq('id', session.attendance_id)
    .single()

  if (!attendance) {
    return { error: 'Atendimento não encontrado' }
  }

  // 6. Get the patient's auth_token
  const { data: patient } = await supabase
    .from('patients')
    .select('auth_token')
    .eq('id', attendance.patient_id)
    .single()

  if (!patient) {
    return { error: 'Paciente não encontrado' }
  }

  // 7. Increment attempt counter
  await supabase
    .from('attendance_sessions')
    .update({ validation_attempts: (session.validation_attempts || 0) + 1 })
    .eq('id', sessionId)

  // 8. Verify token
  if (token !== patient.auth_token) {
    const remaining = MAX_ATTEMPTS - (session.validation_attempts + 1)
    return {
      error: `Token incorreto. ${remaining > 0 ? `Tentativas restantes: ${remaining}` : 'Sem tentativas restantes.'}`,
      attemptsRemaining: remaining,
      blocked: remaining <= 0
    }
  }

  // 9. GEOFENCING — Calculate distance if geo info is available
  // 9. GEOFENCING & SETTINGS — Fetch configuration
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || 'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['enable_token_rotation', 'geofencing_threshold_meters', 'allow_future_attendances', 'signature_window_hours', 'system_timezone', 'system_timezone_offset'])

  const settingsMap = new Map(settings?.map(s => [s.key, s.value]))
  const threshold = Number(settingsMap.get('geofencing_threshold_meters')) || 500
  const isRotationEnabled = settingsMap.get('enable_token_rotation') === true || settingsMap.get('enable_token_rotation') === 'true'
  const allowFuture = settingsMap.get('allow_future_attendances') === undefined ? true : (settingsMap.get('allow_future_attendances') === true || settingsMap.get('allow_future_attendances') === 'true')
  const windowHours = Number(settingsMap.get('signature_window_hours')) || 2
  const systemTimezone = settingsMap.get('system_timezone') || 'America/Sao_Paulo'
  const timezoneOffset = settingsMap.get('system_timezone_offset') || '-03:00'

  // --- VALIDATION: FUTURE DATE CHECK ---
  const now = new Date()
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(now)
  const todayEnd = new Date(`${todayLocal}T23:59:59.999${timezoneOffset}`)
  const sessionDate = new Date(session.session_date + `T00:00:00${timezoneOffset}`)

  if (!allowFuture && sessionDate > todayEnd) {
    return { error: 'O registro de frequências futuras não é permitido pelas configurações do sistema.' }
  }

  // --- VALIDATION: SIGNATURE WINDOW CHECK ---
  const scheduledDateTime = new Date(`${session.session_date}T${session.start_time}${timezoneOffset}`)
  const diffMs = now.getTime() - scheduledDateTime.getTime()
  const diffHours = Math.abs(diffMs / (1000 * 60 * 60))

  if (diffHours > windowHours) {
    return {
      error: `Assinatura negada. O horário atual está fora da janela permitida (${windowHours}h) para o atendimento marcado às ${session.start_time.substring(0, 5)}.`
    }
  }

  let validation_distance = null
  let is_out_of_range = false

  if (geo && (attendance as any).clinic?.latitude && (attendance as any).clinic?.longitude) {
    const R = 6371e3 // metres
    const lat1 = (attendance as any).clinic.latitude
    const lon1 = (attendance as any).clinic.longitude
    const lat2 = geo.lat
    const lon2 = geo.lng

    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    validation_distance = R * c
    if (validation_distance > threshold) {
      is_out_of_range = true
    }
  }

  // 10. SUCCESS — Prepare sessions to update
  const sessionsToUpdate = [{ id: sessionId, attendance_id: session.attendance_id }]

  if (validateAllToday) {
    const { data: clinicConfig } = await supabase
      .from('clinics')
      .select('allows_multiple_signatures')
      .eq('id', attendance.clinic_id)
      .single()

    if (clinicConfig?.allows_multiple_signatures) {
      const { data: otherSessions } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          attendance_id,
          attendances!inner(patient_id, clinic_id)
        `)
        .eq('session_date', session.session_date)
        .is('validated_at', null)
        .neq('id', sessionId)
        .eq('attendances.patient_id', attendance.patient_id)
        .eq('attendances.clinic_id', attendance.clinic_id)

      if (otherSessions && otherSessions.length > 0) {
        otherSessions.forEach((s: any) => {
          sessionsToUpdate.push({ id: s.id, attendance_id: s.attendance_id })
        })
      }
    }
  }

  const sessionIds = sessionsToUpdate.map(s => s.id)
  const { error: updateError } = await supabase
    .from('attendance_sessions')
    .update({
      status: 'Realizada',
      validated_at: new Date().toISOString(),
      validation_ip: ip,
      validation_ua: userAgent,
      validation_geo: geo,
      validation_distance,
      is_out_of_range: is_out_of_range,
      validation_nonce: null,
      validation_type: 'QR_CODE'
    })
    .in('id', sessionIds)

  if (updateError) {
    return { error: 'Erro ao atualizar sessões' }
  }

  // 10. TOKEN ROTATION — Optional based on settings
  if (isRotationEnabled) {
    const newToken = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    await supabase
      .from('patients')
      .update({
        auth_token: newToken,
        token_updated_at: new Date().toISOString()
      })
      .eq('id', attendance.patient_id)
  }

  // 11. RECALCULATE TOTAL VALUES FOR ALL AFFECTED ATTENDANCES
  const uniqueAttendanceIds = Array.from(new Set(sessionsToUpdate.map(s => s.attendance_id)))
  
  for (const attId of uniqueAttendanceIds) {
    const { data: att } = await supabase
      .from('attendances')
      .select('patient_id, clinic_id, procedure_id, attendance_date')
      .eq('id', attId)
      .single()

    if (!att) continue

    const { data: allSessions } = await supabase
      .from('attendance_sessions')
      .select('status')
      .eq('attendance_id', attId)

    const realizedCount = (allSessions || []).filter((s: any) => s.status === 'Realizada').length

    const { data: contractPrice } = await supabase
      .from('clinic_procedure_prices')
      .select('valor_total')
      .eq('clinic_id', att.clinic_id)
      .eq('procedure_id', att.procedure_id)
      .eq('active', true)
      .lte('valid_from', att.attendance_date)
      .or(`valid_to.is.null,valid_to.gte.${att.attendance_date}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    let unitValue = 0
    if (contractPrice) {
      unitValue = Number(contractPrice.valor_total)
    } else {
      const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', att.procedure_id).single()
      unitValue = Number(proc?.valor_total) || 0
    }

    await supabase
      .from('attendances')
      .update({
        value_applied: realizedCount * unitValue,
        quantity: realizedCount,
        status: realizedCount > 0 ? 'Realizada' : 'Pendente'
      })
      .eq('id', attId)
  }

  // 12. AUDIT LOGGING FOR EACH UPDATED SESSION
  for (const s of sessionsToUpdate) {
    const isMain = s.id === sessionId
    await logAudit({
      action: 'UPDATE',
      table_name: 'attendance_sessions',
      record_id: s.id,
      new_data: {
        status: 'Realizada',
        validation_method: 'Digital',
        ip,
        is_out_of_range,
        distance: validation_distance,
        validation_geo: geo,
        unified_signature: !isMain
      },
      description: isMain 
        ? `Paciente assinou digitalmente a sessão ID: ${s.id} (Atendimento: ${s.attendance_id}).`
        : `Paciente assinou digitalmente via assinatura unificada a sessão ID: ${s.id} (Atendimento: ${s.attendance_id}).`
    })
  }

  return { success: true }
}

/**
 * Checks the current status of a session.
 * Used for polling from the QRCodeModal.
 */
export async function checkSessionStatusAction(sessionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (error) return { error: error.message }
  return { status: data.status }
}

/**
 * Helper to validate session conflicts (Overlap for patients and professionals)
 */
async function validateSessionsAction(
  supabase: any,
  attendanceId: string | null,
  patientId: string,
  professionalId: string,
  sessions: any[]
) {
  // 1. Check for Internal Conflicts (BR-003) - Same guide, same time
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];
      if (s1.session_date === s2.session_date) {
        // Basic overlap check
        if (s1.start_time < s2.end_time && s2.start_time < s1.end_time) {
          return {
            error: `Conflito Interno: Existem duas sessões marcadas para o mesmo horário (${s1.start_time} - ${s1.end_time}) na data ${new Date(s1.session_date + 'T00:00:00').toLocaleDateString('pt-BR')}.`
          }
        }
      }
    }
  }

  // 2. Check for External Conflicts (BR-001, BR-002) - Using the Postgres function
  for (const s of sessions) {
    const { data: conflictMsg, error: conflictErr } = await supabase.rpc('check_attendance_session_conflicts', {
      p_session_id: s.id || '00000000-0000-0000-0000-000000000000',
      p_attendance_id: attendanceId,
      p_patient_id: patientId,
      p_professional_id: professionalId,
      p_date: s.session_date,
      p_start: s.start_time,
      p_end: s.end_time
    });

    if (conflictErr) {
      console.error('Error checking conflicts:', conflictErr);
    } else if (conflictMsg) {
      // Use the specific message from RPC or a generic one
      return {
        error: `${conflictMsg} (Data: ${new Date(s.session_date + 'T00:00:00').toLocaleDateString('pt-BR')}, Início: ${s.start_time.substring(0, 5)})`
      };
    }
  }

  return null;
}

export async function getAttachmentsAction(attendanceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance_attachments')
    .select('*')
    .eq('attendance_id', attendanceId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching attachments:', error)
    return []
  }
  return data || []
}

export async function getAttachmentSignedUrlAction(filePath: string) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  // 1. Fetch attachment and verify clinic access using RLS on database
  const { data: attachment, error: dbError } = await supabase
    .from('attendance_attachments')
    .select('*, attendances(clinic_id)')
    .eq('file_path', filePath)
    .single()

  if (dbError || !attachment) {
    console.error('Error verifying attachment access:', dbError)
    return null
  }

  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && !profile?.linked_clinics?.some((c: any) => c.clinic_id === (attachment as any).attendances?.clinic_id)) {
    console.error('Unauthorized access to attachment:', filePath)
    return null
  }

  // 2. Generate signed URL using admin client to avoid self-hosted storage RLS bugs
  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase.storage
    .from('attendance-attachments')
    .createSignedUrl(filePath, 900)

  if (error) {
    console.error('Error creating signed URL with admin client:', error)
    return null
  }
  return data?.signedUrl || null
}

export async function deleteAttachmentAction(id: string, filePath: string) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  const { data: attachment } = await supabase
    .from('attendance_attachments')
    .select('*, attendances(clinic_id)')
    .eq('id', id)
    .single()

  if (!attachment) return { error: 'Anexo não encontrado' }

  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && !profile?.linked_clinics?.some((c: any) => c.clinic_id === (attachment as any).attendances?.clinic_id)) {
    return { error: 'Você não tem permissão para excluir anexos de outra clínica.' }
  }

  const { error: storageError } = await supabase.storage
    .from('attendance-attachments')
    .remove([filePath])

  if (storageError) {
    console.error('Storage deletion error:', storageError)
  }

  const { error: dbError } = await supabase
    .from('attendance_attachments')
    .delete()
    .eq('id', id)

  if (dbError) return { error: dbError.message }

  await logAudit({
    action: 'DELETE',
    table_name: 'attendance_attachments',
    record_id: id,
    old_data: attachment,
    description: `Excluiu o anexo "${attachment.file_name}" do atendimento ID: ${attachment.attendance_id}.`
  })

  return { success: true }
}

export async function saveAttachmentRecordAction(
  attendanceId: string,
  filePath: string,
  fileName: string,
  sizeBytes: number
) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  const { data: attendance } = await supabase
    .from('attendances')
    .select('clinic_id')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'Atendimento não encontrado' }

  if (['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '') && !profile?.linked_clinics?.some((c: any) => c.clinic_id === attendance.clinic_id)) {
    return { error: 'Você não tem permissão para adicionar anexos a esta clínica.' }
  }

  const { data: newAttachment, error } = await supabase
    .from('attendance_attachments')
    .insert({
      attendance_id: attendanceId,
      file_path: filePath,
      file_name: fileName,
      size_bytes: sizeBytes
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logAudit({
    action: 'CREATE',
    table_name: 'attendance_attachments',
    record_id: newAttachment.id,
    new_data: newAttachment,
    description: `Adicionou o anexo "${fileName}" ao atendimento ID: ${attendanceId}.`
  })

  return { success: true, attachment: newAttachment }
}

