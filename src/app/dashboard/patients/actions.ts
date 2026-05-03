'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { patientSchema, type PatientFormData } from './schema'
import { generateToken } from '@/utils/token'

export async function createPatientAction(data: PatientFormData) {
  const supabase = await createClient()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  // Generate a unique 6-digit token for the patient
  let authToken = generateToken()
  
  // Check uniqueness (retry up to 5 times if collision)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_token', authToken)
      .maybeSingle()
    
    if (!existing) break
    authToken = generateToken()
  }

  const { error } = await supabase.from('patients').insert({
    ...validatedFields.data,
    auth_token: authToken,
    token_updated_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/patients')
  redirect('/dashboard/patients')
}

export async function updatePatientAction(id: string, data: PatientFormData) {
  const supabase = await createClient()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  // Do NOT include auth_token in regular updates — it's managed separately
  const { error } = await supabase.from('patients').update({
    ...validatedFields.data,
  }).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/patients')
  redirect('/dashboard/patients')
}

export async function resetPatientTokenAction(patientId: string) {
  const supabase = await createClient()

  // Generate a unique 6-digit token
  let newToken = generateToken()
  
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_token', newToken)
      .neq('id', patientId)
      .maybeSingle()
    
    if (!existing) break
    newToken = generateToken()
  }

  const { error } = await supabase.from('patients').update({
    auth_token: newToken,
    token_updated_at: new Date().toISOString(),
  }).eq('id', patientId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/patients')
  return { token: newToken }
}

export async function deletePatientAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/patients')
}
