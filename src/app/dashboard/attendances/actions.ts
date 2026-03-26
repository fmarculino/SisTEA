'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { attendanceSchema, type AttendanceFormData } from './schema'

export async function createAttendanceAction(data: AttendanceFormData) {
  const supabase = await createClient()
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data
  
  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // Fetch procedure value to ensure correctness
  const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
  const baseValue = Number(proc?.valor_total) || 0
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
  redirect('/dashboard/attendances')
}

export async function updateAttendanceAction(id: string, data: AttendanceFormData) {
  const supabase = await createClient()
  
  const validatedFields = attendanceSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { sessions, ...rawAttendanceData } = validatedFields.data

  if (sessions && sessions.length > rawAttendanceData.authorized_quantity) {
    return { error: `Limite de sessões excedido (${rawAttendanceData.authorized_quantity} autorizadas)` }
  }

  // Fetch procedure value to ensure correctness
  const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', rawAttendanceData.procedure_id).single()
  const baseValue = Number(proc?.valor_total) || 0
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
  redirect('/dashboard/attendances')
}

export async function deleteAttendanceAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('attendances').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/attendances')
}
