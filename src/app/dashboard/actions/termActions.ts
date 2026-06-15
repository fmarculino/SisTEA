'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function acceptTermAction(termVersionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Não autorizado' }
  
  const reqHeaders = await headers()
  const ipAddress = reqHeaders.get('x-forwarded-for') || '127.0.0.1'
  const userAgent = reqHeaders.get('user-agent') || 'Desconhecido'
  
  const { error } = await supabase
    .from('terms_acceptances')
    .insert({
      user_id: user.id,
      term_version_id: termVersionId,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    
  if (error) {
    console.error('Erro ao registrar aceite:', error)
    return { error: 'Erro ao registrar aceite. Tente novamente.' }
  }
  
  revalidatePath('/dashboard')
  return { success: true }
}
