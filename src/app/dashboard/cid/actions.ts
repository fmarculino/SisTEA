'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cidSchema, type CidFormData } from './schema'

export async function createCidAction(data: CidFormData) {
  const supabase = await createClient()
  
  const validatedFields = cidSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('cid').insert(validatedFields.data)

  if (error) {
    if (error.code === '23505') return { error: 'Este código CID já está cadastrado.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/cid')
  redirect('/dashboard/cid')
}

export async function updateCidAction(id: string, data: CidFormData) {
  const supabase = await createClient()
  
  const validatedFields = cidSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('cid').update(validatedFields.data).eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Este código CID já está cadastrado.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/cid')
  redirect('/dashboard/cid')
}

export async function toggleCidStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cid')
    .update({ active: !currentStatus })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/cid')
  return { success: true }
}
