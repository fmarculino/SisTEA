'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { attendanceSchema, type AttendanceFormData } from './schema'
import { buildValidationURL, generateValidationHMAC } from '@/utils/token'
import { headers } from 'next/headers'

async function checkCompetenceLock(supabase: any, clinic_id: string, attendance_date: string) {
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

  if (competence?.status === 'FECHADA') {
    return { error: 'A competência para a data informada está encerrada e não permite alterações. Solicite a reabertura ao administrador.' }
  }
  return null
}

export async function createAttendanceAction(data: AttendanceFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

  // --- SECURITY: Force "Pendente" status for CLINIC_USER ---
  if (profile?.role === 'CLINIC_USER' && sessions) {
    sessions.forEach(s => { s.status = 'Pendente' })
  }
  
  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, rawAttendanceData.clinic_id, rawAttendanceData.attendance_date)
  if (compError) return compError

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

  let baseValue = 0
  if (contractPrice) {
    baseValue = Number(contractPrice.valor_total)
  } else {
    // Fallback to global procedure price if no specific contract is found
    const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
    baseValue = Number(proc?.valor_total) || 0
  }

  const realizedSessions = sessions?.filter(s => s.status === 'Realizada').length || 0
  const finalValue = realizedSessions * baseValue

  const attendanceData = {
    ...rawAttendanceData,
    value_applied: finalValue,
    authorization_date: rawAttendanceData.authorization_date || null,
  }

  const { data: attendance, error } = await supabase.from('attendances').insert({
    ...attendanceData,
  }).select().single()

  if (error) return { error: error.message }

  if (sessions && sessions.length > 0) {
    const sessionsToInsert = sessions.map(session => ({
      attendance_id: attendance.id,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status,
      justification: session.justification,
    }))
    
    const { error: sessionError } = await supabase.from('attendance_sessions').insert(sessionsToInsert)
    if (sessionError) return { error: `Erro ao salvar sessões: ${sessionError.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
  redirect(`/dashboard/attendances/${attendance.id}/edit`)
}

export async function updateAttendanceAction(id: string, data: AttendanceFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // --- SECURITY: Fetch current state to prevent tampering after validation ---
  const { data: currentAttendance } = await supabase
    .from('attendances')
    .select('patient_id, professional_id, procedure_id, attendance_date, sessions:attendance_sessions(status)')
    .eq('id', id)
    .single()

  if (!currentAttendance) return { error: 'Atendimento não encontrado' }

  const dbSessions = (currentAttendance as any).sessions || []
  const hasValidatedInDb = dbSessions.some((s: any) => s.status === 'Realizada' || s.status === 'Glosada')

  if (profile?.role === 'CLINIC_USER' && hasValidatedInDb) {
    // If ANY session is validated, critical header fields become IMMUTABLE
    const patientChanged = rawAttendanceData.patient_id !== currentAttendance.patient_id
    const professionalChanged = rawAttendanceData.professional_id !== currentAttendance.professional_id
    const procedureChanged = rawAttendanceData.procedure_id !== currentAttendance.procedure_id
    const dateChanged = rawAttendanceData.attendance_date !== currentAttendance.attendance_date

    if (patientChanged || professionalChanged || procedureChanged || dateChanged) {
      return { 
        error: 'Não é possível alterar o Paciente, Profissional, Procedimento ou Data de Competência após uma sessão ter sido realizada ou glosada.' 
      }
    }
  }

  // --- SECURITY: Check session status consistency ---
  if (profile?.role === 'CLINIC_USER' && sessions) {
    const hasRealizada = sessions.some(s => s.status === 'Realizada')
    if (hasRealizada || hasValidatedInDb) {
      // Re-fetch sessions with more details for consistency check
      const { data: fullSessions } = await supabase
        .from('attendance_sessions')
        .select('id, status, validated_at, session_date, start_time, end_time')
        .eq('attendance_id', id)
      
      const existingSessionsMap = new Map((fullSessions || []).map((s: any) => [s.id, s]))

      // Any "Realizada" session that wasn't previously validated = fraud attempt
      for (const session of sessions) {
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

  let baseValue = 0
  if (contractPrice) {
    baseValue = Number(contractPrice.valor_total)
  } else {
    // Fallback to global procedure price if no specific contract is found
    const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
    baseValue = Number(proc?.valor_total) || 0
  }

  const realizedSessions = sessions?.filter(s => s.status === 'Realizada').length || 0
  const finalValue = realizedSessions * baseValue

  const attendanceData = {
    ...rawAttendanceData,
    value_applied: finalValue,
    authorization_date: rawAttendanceData.authorization_date || null,
  }

  const { error } = await supabase.from('attendances').update({
    ...attendanceData,
  }).eq('id', id)

  if (error) return { error: error.message }

  // --- SESSION MANAGEMENT ---
  // Identify sessions that should be preserved (already validated)
  // SMS_ADMIN can override this if they are resetting a session to "Pendente"
  const { data: existingSessions } = await supabase
    .from('attendance_sessions')
    .select('id, validated_at')
    .eq('attendance_id', id)

  const validatedSessionIds = (existingSessions || [])
    .filter((s: any) => s.validated_at)
    .map((s: any) => s.id)

  // Identify sessions that MUST stay (validated ones that are NOT being reset by Admin)
  const sessionsToKeepIds = validatedSessionIds.filter(vId => {
    if (profile?.role === 'SMS_ADMIN') {
      const incoming = sessions?.find(s => s.id === vId)
      // If admin sets it to Pendente, we DON'T keep the validated version (we want to re-insert it as fresh Pendente)
      if (incoming && incoming.status === 'Pendente') return false
    }
    return true
  })

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
      .map(session => ({
        attendance_id: id,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        justification: session.justification,
      }))
    
    if (newSessionsToInsert.length > 0) {
      const { error: sessionError } = await supabase.from('attendance_sessions').insert(newSessionsToInsert)
      if (sessionError) return { error: `Erro ao salvar sessões: ${sessionError.message}` }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
  revalidatePath(`/dashboard/attendances/${id}/edit`)
  redirect(`/dashboard/attendances/${id}/edit`)
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

  // --- SECURITY: CLINIC_USER cannot delete if any session is Realizada or Glosada ---
  if (profile?.role === 'CLINIC_USER') {
    const sessions = (attendance as any).sessions || []
    const hasValidated = sessions.some((s: any) => s.status === 'Realizada' || s.status === 'Glosada')
    if (hasValidated) {
      return { error: 'Não é possível excluir um atendimento que possui sessões já realizadas ou glosadas.' }
    }
  }

  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, attendance.clinic_id, attendance.attendance_date)
  if (compError) return compError

  const { error } = await supabase.from('attendances').delete().eq('id', id)
  if (error) return { error: error.message }
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

  // Generate a nonce for this validation attempt
  const timestamp = Date.now()
  const nonce = generateValidationHMAC(session.id, timestamp)

  // Store the nonce in the session record
  await supabase
    .from('attendance_sessions')
    .update({ validation_nonce: nonce, validation_attempts: 0 })
    .eq('id', session.id)

  // Get the base URL from headers
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`

  const url = buildValidationURL(baseUrl, session.id)

  return { url }
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
