'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { procedureSchema, type ProcedureFormData } from './schema'

export async function createProcedureAction(data: ProcedureFormData) {
  const supabase = await createClient()
  
  const validatedFields = procedureSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { specialty_ids, service_classification_ids, cid_ids, hasNoCode, ...procedureData } = validatedFields.data

  const finalProcedureData = {
    ...procedureData,
    code: hasNoCode ? null : (procedureData.code?.replace(/\D/g, '') || null)
  }

  const { data: procedure, error } = await supabase.from('procedures').insert({
    ...finalProcedureData,
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de procedimento já está cadastrado.' }
    }
    return { error: error.message }
  }

  // Insert associations
  const tasks = []

  if (specialty_ids && specialty_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_specialties').insert(
        specialty_ids.map(id => ({ procedure_id: procedure.id, specialty_id: id }))
      )
    )
  }

  if (service_classification_ids && service_classification_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_service_classifications').insert(
        service_classification_ids.map(id => ({ procedure_id: procedure.id, service_classification_id: id }))
      )
    )
  }

  if (cid_ids && cid_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_cid').insert(
        cid_ids.map(id => ({ procedure_id: procedure.id, cid_id: id }))
      )
    )
  }

  if (tasks.length > 0) {
    const results = await Promise.all(tasks)
    const errorTask = results.find(r => r.error)
    if (errorTask) return { error: `Erro ao salvar associações: ${errorTask.error?.message}` }
  }

  revalidatePath('/dashboard/procedures')
  redirect('/dashboard/procedures')
}

export async function updateProcedureAction(id: string, data: ProcedureFormData) {
  const supabase = await createClient()
  
  const validatedFields = procedureSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { specialty_ids, service_classification_ids, cid_ids, hasNoCode, ...procedureData } = validatedFields.data

  const finalProcedureData = {
    ...procedureData,
    code: hasNoCode ? null : (procedureData.code?.replace(/\D/g, '') || null)
  }

  const { error } = await supabase.from('procedures').update({
    ...finalProcedureData,
  }).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de procedimento já está cadastrado.' }
    }
    return { error: error.message }
  }

  // Update associations: delete and re-insert
  await Promise.all([
    supabase.from('procedure_specialties').delete().eq('procedure_id', id),
    supabase.from('procedure_service_classifications').delete().eq('procedure_id', id),
    supabase.from('procedure_cid').delete().eq('procedure_id', id),
  ])
  
  const tasks = []

  if (specialty_ids && specialty_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_specialties').insert(
        specialty_ids.map(sid => ({ procedure_id: id, specialty_id: sid }))
      )
    )
  }

  if (service_classification_ids && service_classification_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_service_classifications').insert(
        service_classification_ids.map(scid => ({ procedure_id: id, service_classification_id: scid }))
      )
    )
  }

  if (cid_ids && cid_ids.length > 0) {
    tasks.push(
      supabase.from('procedure_cid').insert(
        cid_ids.map(cidId => ({ procedure_id: id, cid_id: cidId }))
      )
    )
  }

  if (tasks.length > 0) {
    const results = await Promise.all(tasks)
    const errorTask = results.find(r => r.error)
    if (errorTask) return { error: `Erro ao atualizar associações: ${errorTask.error?.message}` }
  }

  revalidatePath('/dashboard/procedures')
  redirect('/dashboard/procedures')
}

export async function deleteProcedureAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('procedures').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/procedures')
}
