'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { serviceClassificationSchema, type ServiceClassificationFormData } from './schema'

export async function createServiceClassificationAction(data: ServiceClassificationFormData) {
  const supabase = await createClient()
  
  const validatedFields = serviceClassificationSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('service_classifications').insert(validatedFields.data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/service-classifications')
  redirect('/dashboard/service-classifications')
}

export async function updateServiceClassificationAction(id: string, data: ServiceClassificationFormData) {
  const supabase = await createClient()
  
  const validatedFields = serviceClassificationSchema.safeParse(data)
  if (!validatedFields.success) {
    const errorMsg = validatedFields.error.issues.map(issue => issue.message).join(', ')
    return { error: `Erro de validação: ${errorMsg}` }
  }

  const { error } = await supabase.from('service_classifications').update(validatedFields.data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/service-classifications')
  redirect('/dashboard/service-classifications')
}

export async function toggleServiceClassificationStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('service_classifications')
    .update({ active: !currentStatus })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/service-classifications')
  return { success: true }
}


