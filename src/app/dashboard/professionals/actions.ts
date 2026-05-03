'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { professionalSchema, type ProfessionalFormData } from './schema'
import { logAudit } from '@/lib/audit'

export async function createProfessionalAction(data: ProfessionalFormData) {
  const supabase = await createClient()
  
  const validatedFields = professionalSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { clinic_ids, specialty_ids, ...professionalData } = validatedFields.data

  const profId = crypto.randomUUID()

  // Check for duplicate CNS
  if (professionalData.cns) {
    const { data: existing } = await supabase.from('professionals').select('id').eq('cns', professionalData.cns).maybeSingle()
    if (existing) {
      return { error: 'Já existe um profissional cadastrado com este CNS.' }
    }
  }

  const { error: profError } = await supabase.from('professionals').insert({
    id: profId,
    ...professionalData,
    cpf: professionalData.cpf || null,
    email: professionalData.email || null,
  })

  if (profError) {
    if (profError.code === '23505') {
       if (profError.message.includes('cpf')) return { error: 'Este CPF já está cadastrado para outro profissional.' }
       if (profError.message.includes('cns')) return { error: 'Este CNS já está cadastrado para outro profissional.' }
    }
    return { error: profError.message }
  }

  // Insert clinic associations
  if (clinic_ids && clinic_ids.length > 0) {
    const associations = clinic_ids.map(clinic_id => ({
      professional_id: profId,
      clinic_id
    }))
    const { error: assocError } = await supabase.from('professional_clinics').insert(associations)
    if (assocError) return { error: assocError.message }
  }

  // Insert specialty associations
  if (specialty_ids && specialty_ids.length > 0) {
    const associations = specialty_ids.map(specialty_id => ({
      professional_id: profId,
      specialty_id
    }))
    const { error: specError } = await supabase.from('professional_specialties').insert(associations)
    if (specError) return { error: specError.message }
  }

  revalidatePath('/dashboard/professionals')

  // Log audit
  await logAudit({
    action: 'CREATE',
    table_name: 'professionals',
    record_id: profId,
    new_data: { ...professionalData, specialty_ids, clinic_ids },
    description: `Cadastrou o profissional: ${data.name} (CNS: ${data.cns}).`
  })

  redirect('/dashboard/professionals')
}

export async function updateProfessionalAction(id: string, data: ProfessionalFormData) {
  const supabase = await createClient()
  
  const validatedFields = professionalSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { clinic_ids, specialty_ids, ...professionalData } = validatedFields.data

  // Check for duplicate CNS for another professional
  if (professionalData.cns) {
    const { data: existing } = await supabase.from('professionals').select('id').eq('cns', professionalData.cns).neq('id', id).maybeSingle()
    if (existing) {
      return { error: 'Já existe um profissional cadastrado com este CNS.' }
    }
  }

  const { error: profError } = await supabase.from('professionals').update({
    ...professionalData,
    cpf: professionalData.cpf || null,
    email: professionalData.email || null,
  }).eq('id', id)

  if (profError) {
    if (profError.code === '23505') {
       if (profError.message.includes('cpf')) return { error: 'Este CPF já está cadastrado para outro profissional.' }
       if (profError.message.includes('cns')) return { error: 'Este CNS já está cadastrado para outro profissional.' }
    }
    return { error: profError.message }
  }

  // Sync clinic associations
  await supabase.from('professional_clinics').delete().eq('professional_id', id)
  if (clinic_ids && clinic_ids.length > 0) {
    const associations = clinic_ids.map(clinic_id => ({
      professional_id: id,
      clinic_id
    }))
    const { error: assocError } = await supabase.from('professional_clinics').insert(associations)
    if (assocError) return { error: assocError.message }
  }

  // Sync specialty associations
  await supabase.from('professional_specialties').delete().eq('professional_id', id)
  if (specialty_ids && specialty_ids.length > 0) {
    const associations = specialty_ids.map(specialty_id => ({
      professional_id: id,
      specialty_id
    }))
    const { error: specError } = await supabase.from('professional_specialties').insert(associations)
    if (specError) return { error: specError.message }
  }

  revalidatePath('/dashboard/professionals')

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'professionals',
    record_id: id,
    new_data: { ...professionalData, specialty_ids, clinic_ids },
    description: `Atualizou dados do profissional: ${data.name}.`
  })

  redirect('/dashboard/professionals')
}

export async function deleteProfessionalAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('professionals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/professionals')

  // Log audit
  await logAudit({
    action: 'DELETE',
    table_name: 'professionals',
    record_id: id,
    description: `Excluiu o registro do profissional ID: ${id}.`
  })

  return { success: true }
}
