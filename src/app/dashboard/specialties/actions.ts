'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { specialtySchema, type SpecialtyFormData } from './schema'

export async function createSpecialtyAction(data: SpecialtyFormData) {
  const supabase = await createClient()
  
  const validatedFields = specialtySchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('specialties').insert(validatedFields.data)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/specialties')
  redirect('/dashboard/specialties')
}

export async function updateSpecialtyAction(id: string, data: SpecialtyFormData) {
  const supabase = await createClient()
  
  const validatedFields = specialtySchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('specialties').update(validatedFields.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/specialties')
  redirect('/dashboard/specialties')
}

export async function deleteSpecialtyAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('specialties').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/specialties')
}
