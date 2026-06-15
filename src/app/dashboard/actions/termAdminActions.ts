'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { revalidatePath } from 'next/cache'

async function checkAdmin() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    throw new Error('Não autorizado')
  }
}

export async function createTermVersionAction(version: string, content: string, active: boolean) {
  try {
    await checkAdmin()
    
    if (!version || !content) {
      return { error: 'Versão e conteúdo são obrigatórios' }
    }
    
    const supabase = await createClient()

    // If making this active, deactivate other versions first
    if (active) {
      const { error: deactivateError } = await supabase
        .from('terms_versions')
        .update({ active: false })
        .eq('active', true)
        
      if (deactivateError) {
        console.error('Erro ao desativar termos anteriores:', deactivateError)
        return { error: 'Erro ao processar ativação de termo' }
      }
    }

    const { error: insertError } = await supabase
      .from('terms_versions')
      .insert({
        version,
        content,
        active
      })

    if (insertError) {
      console.error('Erro ao salvar termo:', insertError)
      if (insertError.code === '23505') {
        return { error: 'Esta versão de termo já está cadastrada' }
      }
      return { error: 'Erro ao criar nova versão do termo' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings/terms')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Erro inesperado' }
  }
}

export async function deleteTermVersionAction(id: string) {
  try {
    await checkAdmin()
    
    const supabase = await createClient()

    // Verify if there are acceptances
    const { count, error: countError } = await supabase
      .from('terms_acceptances')
      .select('*', { count: 'exact', head: true })
      .eq('term_version_id', id)

    if (countError) {
      console.error('Erro ao checar aceites:', countError)
      return { error: 'Erro ao verificar dependências do termo' }
    }

    if (count && count > 0) {
      return { error: 'Não é possível excluir um termo que já foi aceito por usuários.' }
    }

    const { error: deleteError } = await supabase
      .from('terms_versions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao excluir termo:', deleteError)
      return { error: 'Erro ao excluir o termo' }
    }

    revalidatePath('/dashboard/settings/terms')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Erro inesperado' }
  }
}
