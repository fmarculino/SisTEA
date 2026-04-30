'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { attendanceSchema, type AttendanceFormData } from './schema'

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
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data
  
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
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

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

  const { error } = await supabase.from('attendances').update({
    ...attendanceData,
  }).eq('id', id)

  if (error) return { error: error.message }

  // Excluir sessões antigas e re-inserir para sincronizar state
  await supabase.from('attendance_sessions').delete().eq('attendance_id', id)

  if (sessions && sessions.length > 0) {
    const sessionsToInsert = sessions.map(session => ({
      attendance_id: id,
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
  revalidatePath(`/dashboard/attendances/${id}/edit`)
  redirect(`/dashboard/attendances/${id}/edit`)
}

export async function deleteAttendanceAction(id: string) {
  const supabase = await createClient()

  // --- GET EXISTING ATTENDANCE FOR COMPETENCE CHECK ---
  const { data: attendance } = await supabase.from('attendances').select('attendance_date, clinic_id').eq('id', id).single()
  
  // --- COMPETENCE CHECK ---
  const compError = await checkCompetenceLock(supabase, attendance.clinic_id, attendance.attendance_date)
  if (compError) return compError

  const { error } = await supabase.from('attendances').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
}
