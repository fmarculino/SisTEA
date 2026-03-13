'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { procedureSchema, type ProcedureFormData } from './schema'

export async function createProcedureAction(data: ProcedureFormData) {
  const supabase = await createClient()
  
  const validatedFields = procedureSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('procedures').insert({
    ...validatedFields.data,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/procedures')
  redirect('/dashboard/procedures')
}

export async function updateProcedureAction(id: string, data: ProcedureFormData) {
  const supabase = await createClient()
  
  const validatedFields = procedureSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  const { error } = await supabase.from('procedures').update({
    ...validatedFields.data,
  }).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/procedures')
  redirect('/dashboard/procedures')
}

export async function deleteProcedureAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('procedures').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/procedures')
}
