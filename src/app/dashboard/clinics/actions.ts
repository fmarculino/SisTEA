'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clinicSchema, type ClinicFormData } from './schema'

export async function createClinicAction(data: ClinicFormData) {
  const supabase = await createClient()
  
  const validatedFields = clinicSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('clinics').insert({
    ...validatedFields.data,
    email: validatedFields.data.email || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este CNPJ já está cadastrado para outra clínica.' }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard/clinics')
  redirect('/dashboard/clinics')
}

export async function updateClinicAction(id: string, data: ClinicFormData) {
  const supabase = await createClient()
  
  const validatedFields = clinicSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('clinics').update({
    ...validatedFields.data,
    email: validatedFields.data.email || null,
  }).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este CNPJ já está cadastrado para outra clínica.' }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard/clinics')
  redirect('/dashboard/clinics')
}

export async function toggleClinicStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clinics')
    .update({ active: !currentStatus })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/clinics')
  return { success: true }
}

/*
export async function deleteClinicAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('clinics').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/clinics')
}
*/
