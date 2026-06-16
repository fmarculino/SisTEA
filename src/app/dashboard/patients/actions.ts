'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { patientSchema, type PatientFormData } from './schema'
import { logAudit } from '@/lib/audit'
import { generateToken } from '@/utils/token'

export async function checkPatientByCNSAction(cns: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('check_patient_by_cns', { p_cns: cns })
    .maybeSingle()

  if (error) return { error: error.message }
  return { patient: data }
}

export async function linkPatientToClinicAction(patientId: string, clinicId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_clinics')
    .insert({ 
      patient_id: patientId, 
      clinic_id: clinicId,
      active: true 
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este paciente já está vinculado à sua clínica.' }
    }
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/patients')

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'patient_clinics',
    record_id: `${patientId}_${clinicId}`,
    description: `Vinculou o paciente ID: ${patientId} à clínica ID: ${clinicId}.`
  })

  return { success: true }
}

export async function togglePatientClinicStatusAction(patientId: string, clinicId: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_clinics')
    .update({ active: active })
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/patients')
  revalidatePath(`/dashboard/patients/${patientId}`)

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'patient_clinics',
    record_id: `${patientId}_${clinicId}`,
    new_data: { active },
    description: `${active ? 'Ativou' : 'Desativou'} o vínculo do paciente ID: ${patientId}.`
  })

  return { success: true }
}

export async function createPatientAction(data: PatientFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { clinic_ids, clinic_id: formClinicId, ...patientData } = validatedFields.data

  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')
  if (isClinicRole) {
    const userClinicIds = new Set(profile?.linked_clinics?.map((c: any) => c.clinic_id) || [])
    const hasInvalidClinic = clinic_ids.some(cid => !userClinicIds.has(cid))
    if (hasInvalidClinic) {
      return { error: 'Você não tem permissão para vincular pacientes a clínicas fora do seu grupo.' }
    }
  }

  const primaryClinicId = clinic_ids[0]

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

  // 1. Insert into patients
  const { data: newPatient, error: patientError } = await supabase
    .from('patients')
    .insert({
      ...patientData,
      cpf: patientData.cpf || null, // Ensure empty string becomes null
      clinic_id: primaryClinicId,
      auth_token: authToken,
      token_updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (patientError) {
    if (patientError.code === '23505') {
      return { error: 'Este CNS já está cadastrado em outra clínica. Digite o CNS novamente para ativar o vínculo automático.' }
    }
    return { error: patientError.message }
  }

  // 2. Insert into patient_clinics
  const links = clinic_ids.map(cid => ({
    patient_id: newPatient.id,
    clinic_id: cid,
    active: data.active // Use the active status from the form
  }))

  const { error: linkError } = await supabase
    .from('patient_clinics')
    .insert(links)

  if (linkError) return { error: linkError.message }

  revalidatePath('/dashboard/patients')

  // Log audit
  await logAudit({
    action: 'CREATE',
    table_name: 'patients',
    record_id: newPatient.id,
    new_data: { ...patientData, clinic_id: primaryClinicId, clinic_ids },
    description: `Cadastrou o paciente: ${data.name} (CNS: ${data.cns_patient}).`
  })

  redirect('/dashboard/patients')
}

export async function updatePatientAction(id: string, data: PatientFormData) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()
  
  const validatedFields = patientSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { active, clinic_ids, clinic_id: formClinicId, ...patientData } = validatedFields.data

  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')
  if (isClinicRole) {
    const { data: patientLinks } = await supabase
      .from('patient_clinics')
      .select('clinic_id')
      .eq('patient_id', id)
    
    const patientClinicIds = patientLinks?.map(pl => pl.clinic_id) || []
    const userClinicIds = profile?.linked_clinics?.map((c: any) => c.clinic_id) || []
    const hasAccessToPatient = patientClinicIds.some(cid => userClinicIds.includes(cid))
    if (!hasAccessToPatient && patientClinicIds.length > 0) {
      return { error: 'Você não tem permissão para editar este paciente.' }
    }

    const userClinicSet = new Set(userClinicIds)
    const hasInvalidClinic = clinic_ids.some(cid => !userClinicSet.has(cid))
    if (hasInvalidClinic) {
      return { error: 'Você não tem permissão para vincular pacientes a clínicas fora do seu grupo.' }
    }
  }

  const patientId = id
  const primaryClinicId = clinic_ids[0]

  // 1. Update basic patient data
  const { error: patientError } = await supabase
    .from('patients')
    .update({
      ...patientData,
      cpf: patientData.cpf || null, // Ensure empty string becomes null
      clinic_id: primaryClinicId, // Sync legacy clinic_id
    })
    .eq('id', patientId)

  if (patientError) return { error: patientError.message }

  // 2. Sincronismo inteligente de clínicas no patient_clinics
  const { data: existingLinks } = await supabase
    .from('patient_clinics')
    .select('clinic_id, active')
    .eq('patient_id', patientId)

  const existingMap = new Map(existingLinks?.map(el => [el.clinic_id, el.active]) || [])

  // Inserir ou atualizar clínicas que estão no clinic_ids
  for (const cid of clinic_ids) {
    const isNew = !existingMap.has(cid)
    const isActive = isNew ? true : (cid === primaryClinicId ? active : (existingMap.get(cid) ?? true))

    const { error: linkError } = await supabase
      .from('patient_clinics')
      .upsert({ 
        patient_id: patientId, 
        clinic_id: cid,
        active: isActive 
      }, { onConflict: 'patient_id,clinic_id' })
    
    if (linkError) return { error: linkError.message }
  }

  // Remover clínicas que não estão mais no clinic_ids
  const idsToRemove = Array.from(existingMap.keys()).filter(cid => !clinic_ids.includes(cid))
  if (idsToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from('patient_clinics')
      .delete()
      .eq('patient_id', patientId)
      .in('clinic_id', idsToRemove)

    if (removeError) return { error: removeError.message }
  }

  revalidatePath('/dashboard/patients')

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'patients',
    record_id: patientId,
    new_data: { ...patientData, active, clinic_id: primaryClinicId, clinic_ids },
    description: `Atualizou dados do paciente: ${data.name}.`
  })

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

  // Log audit
  await logAudit({
    action: 'UPDATE',
    table_name: 'patients',
    record_id: patientId,
    description: `Resetou o Token de Acesso (QR Code) do paciente ID: ${patientId}.`
  })

  return { token: newToken }
}

export async function deletePatientAction(id: string) {
  const supabase = await createClient()
  const { getUserProfile } = await import('@/lib/dal')
  const profile = await getUserProfile()

  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(profile?.role || '')
  if (isClinicRole) {
    const { data: patientLinks } = await supabase
      .from('patient_clinics')
      .select('clinic_id')
      .eq('patient_id', id)
    
    const patientClinicIds = patientLinks?.map(pl => pl.clinic_id) || []
    const userClinicIds = profile?.linked_clinics?.map((c: any) => c.clinic_id) || []
    const hasAccess = patientClinicIds.some(cid => userClinicIds.includes(cid))
    if (!hasAccess && patientClinicIds.length > 0) {
      return { error: 'Você não tem permissão para excluir este paciente.' }
    }
  }

  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/patients')

  // Log audit
  await logAudit({
    action: 'DELETE',
    table_name: 'patients',
    record_id: id,
    description: `Excluiu o registro do paciente ID: ${id}.`
  })

  return { success: true }
}
