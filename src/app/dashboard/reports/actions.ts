'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createReportRequest(filters: any) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Não autorizado')
  }

  const { data, error } = await supabase
    .from('report_requests')
    .insert({
      filters,
      user_id: user.id
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar requisição de relatório:', error)
    throw new Error('Falha ao processar solicitação de impressão')
  }

  return data.id
}
