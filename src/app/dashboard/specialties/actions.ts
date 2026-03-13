'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { specialtySchema, type SpecialtyFormData } from './schema'

export async function createSpecialtyAction(data: SpecialtyFormData) {
  const supabase = await createClient()
  
  const validatedFields = specialtySchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('specialties').insert(validatedFields.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este CBO ou nome de especialidade já está cadastrado.' }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard/specialties')
  redirect('/dashboard/specialties')
}

export async function updateSpecialtyAction(id: string, data: SpecialtyFormData) {
  const supabase = await createClient()
  
  const validatedFields = specialtySchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('specialties').update(validatedFields.data).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este CBO ou nome de especialidade já está cadastrado.' }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard/specialties')
  redirect('/dashboard/specialties')
}

export async function toggleSpecialtyStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('specialties')
    .update({ active: !currentStatus })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialties')
  return { success: true }
}

/*
export async function deleteSpecialtyAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('specialties').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialties')
}
*/
