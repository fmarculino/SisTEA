'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { patientSchema, type PatientFormData } from './schema'

export async function createPatientAction(data: PatientFormData) {
  const supabase = await createClient()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('patients').insert({
    ...validatedFields.data,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/patients')
  redirect('/dashboard/patients')
}

export async function updatePatientAction(id: string, data: PatientFormData) {
  const supabase = await createClient()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('patients').update({
    ...validatedFields.data,
  }).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/patients')
  redirect('/dashboard/patients')
}

export async function deletePatientAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/patients')
}
