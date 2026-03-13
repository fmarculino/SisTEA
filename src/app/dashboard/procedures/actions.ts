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

  const { specialty_ids, ...procedureData } = validatedFields.data

  const { data: procedure, error } = await supabase.from('procedures').insert({
    ...procedureData,
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de procedimento já está cadastrado.' }
    }
    return { error: error.message }
  }

  // Insert specialty associations
  if (specialty_ids && specialty_ids.length > 0) {
    const associations = specialty_ids.map(specialtyId => ({
      procedure_id: procedure.id,
      specialty_id: specialtyId
    }))
    const { error: assocError } = await supabase.from('procedure_specialties').insert(associations)
    if (assocError) return { error: `Erro ao salvar especialidades: ${assocError.message}` }
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

  const { specialty_ids, ...procedureData } = validatedFields.data

  const { error } = await supabase.from('procedures').update({
    ...procedureData,
  }).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de procedimento já está cadastrado.' }
    }
    return { error: error.message }
  }

  // Update specialty associations
  // Simplest way: delete all and insert new ones
  await supabase.from('procedure_specialties').delete().eq('procedure_id', id)
  
  if (specialty_ids && specialty_ids.length > 0) {
    const associations = specialty_ids.map(specialtyId => ({
      procedure_id: id,
      specialty_id: specialtyId
    }))
    const { error: assocError } = await supabase.from('procedure_specialties').insert(associations)
    if (assocError) return { error: `Erro ao atualizar especialidades: ${assocError.message}` }
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
