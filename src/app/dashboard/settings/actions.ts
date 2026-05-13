'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { revalidatePath } from 'next/cache'

export async function updateSystemSettingAction(formData: FormData) {
  const key = formData.get('key') as string
  const value = formData.get('value') as string

  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()

  // Determine the value type to store in JSONB
  let finalValue: any = value
  if (value === 'true') finalValue = true
  else if (value === 'false') finalValue = false
  else if (!isNaN(Number(value)) && value.trim() !== '') finalValue = Number(value)

  const { error } = await supabase
    .from('system_settings')
    .upsert({ 
      key,
      value: finalValue,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Erro ao atualizar configuração:', error)
    return { error: 'Falha ao salvar configuração' }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function updateAllSettingsAction(settings: Record<string, any>) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()

  const entries = Object.entries(settings).map(([key, value]) => {
    // Basic type inference
    let finalValue: any = value
    if (value === 'true' || value === true) finalValue = true
    else if (value === 'false' || value === false) finalValue = false
    else if (!isNaN(Number(value)) && typeof value === 'string' && value.trim() !== '') finalValue = Number(value)

    return {
      key,
      value: finalValue,
      updated_at: new Date().toISOString()
    }
  })

  const { error } = await supabase
    .from('system_settings')
    .upsert(entries)

  if (error) {
    console.error('Erro ao atualizar configurações:', error)
    return { error: 'Falha ao salvar configurações' }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}
