'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/dal'
import { logAudit } from '@/lib/audit'

export async function closeCompetenceAction(clinic_id: string, month: number, year: number) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (!profile || profile.clinic_id !== clinic_id) {
    if (profile?.role !== 'SMS_ADMIN') {
      return { error: 'Sem permissão para fechar esta competência.' }
    }
  }

  const { error } = await supabase.from('competences').upsert({
    clinic_id,
    month,
    year,
    status: 'FECHADA',
    closed_at: new Date().toISOString(),
    closed_by: profile.id
  }, {
    onConflict: 'clinic_id,month,year'
  })

  if (error) return { error: error.message }
  
  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id, month, year, action: 'FECHADA', performed_by: profile.id
  })

  await logAudit({
    action: 'UPDATE',
    table_name: 'competences',
    description: `Encerrou competência ${month}/${year} para a clínica ID: ${clinic_id}`,
    new_data: { status: 'FECHADA', clinic_id, month, year }
  })

  revalidatePath('/dashboard/competences')
  return { success: true }
}

export async function reopenCompetenceAction(id: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    return { error: 'Apenas administradores podem reabrir competências.' }
  }

  // Busca a competência para auditoria e verificação
  const { data: comp } = await supabase.from('competences').select('*').eq('id', id).single()
  
  if (!comp) return { error: 'Competência não encontrada.' }
  if (comp.status === 'ENVIADA_MS') {
    return { error: 'Competência com Hard Lock (Enviada ao MS). Reabertura bloqueada.' }
  }

  const { error } = await supabase.from('competences').delete().eq('id', id)
  
  if (error) return { error: error.message }

  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id: comp.clinic_id, month: comp.month, year: comp.year, action: 'REABERTA', performed_by: profile.id
  })

  await logAudit({
    action: 'DELETE',
    table_name: 'competences',
    record_id: id,
    description: `Reabriu competência ${comp.month}/${comp.year} para a clínica ID: ${comp.clinic_id}`,
    old_data: comp
  })
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}

export async function sendToMSCompetenceAction(id: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    return { error: 'Apenas administradores podem enviar ao MS.' }
  }

  const { data: comp } = await supabase.from('competences').select('*').eq('id', id).single()
  if (!comp) return { error: 'Competência não encontrada.' }

  const { error } = await supabase.from('competences').update({
    status: 'ENVIADA_MS'
  }).eq('id', id)
  
  if (error) return { error: error.message }

  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id: comp.clinic_id, month: comp.month, year: comp.year, action: 'ENVIADA_MS', performed_by: profile.id
  })

  await logAudit({
    action: 'UPDATE',
    table_name: 'competences',
    record_id: id,
    description: `Enviou competência ${comp.month}/${comp.year} ao Ministério da Saúde (Hard Lock) - Clínica ID: ${comp.clinic_id}`,
    new_data: { status: 'ENVIADA_MS' }
  })
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}
