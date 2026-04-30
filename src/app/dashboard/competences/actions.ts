'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/dal'

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
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}

export async function reopenCompetenceAction(id: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    return { error: 'Apenas administradores podem reabrir competências.' }
  }

  const { error } = await supabase.from('competences').delete().eq('id', id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}
