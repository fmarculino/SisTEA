'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { professionalSchema, type ProfessionalFormData } from './schema'

export async function createProfessionalAction(data: ProfessionalFormData) {
  const supabase = await createClient()
  
  const validatedFields = professionalSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { clinic_ids, ...professionalData } = validatedFields.data

  const { data: prof, error: profError } = await supabase.from('professionals').insert({
    ...professionalData,
    email: professionalData.email || null,
  }).select().single()

  if (profError) return { error: profError.message }

  // Insert clinic associations
  if (clinic_ids && clinic_ids.length > 0) {
    const associations = clinic_ids.map(clinic_id => ({
      professional_id: prof.id,
      clinic_id
    }))
    const { error: assocError } = await supabase.from('professional_clinics').insert(associations)
    if (assocError) return { error: assocError.message }
  }

  revalidatePath('/dashboard/professionals')
  redirect('/dashboard/professionals')
}

export async function updateProfessionalAction(id: string, data: ProfessionalFormData) {
  const supabase = await createClient()
  
  const validatedFields = professionalSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { clinic_ids, ...professionalData } = validatedFields.data

  const { error: profError } = await supabase.from('professionals').update({
    ...professionalData,
    email: professionalData.email || null,
  }).eq('id', id)

  if (profError) return { error: profError.message }

  // Sync clinic associations (simplified: delete and re-insert)
  await supabase.from('professional_clinics').delete().eq('professional_id', id)

  if (clinic_ids && clinic_ids.length > 0) {
    const associations = clinic_ids.map(clinic_id => ({
      professional_id: id,
      clinic_id
    }))
    const { error: assocError } = await supabase.from('professional_clinics').insert(associations)
    if (assocError) return { error: assocError.message }
  }

  revalidatePath('/dashboard/professionals')
  redirect('/dashboard/professionals')
}

export async function deleteProfessionalAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('professionals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/professionals')
}
