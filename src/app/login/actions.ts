'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in real app you should validate with zod
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=Credenciais inválidas')
  }

  // Verificar se o usuário e a clínica estão ativos
  const { data: profile } = await supabase
    .from('users')
    .select('role, active, clinic:clinics(active)')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (profile) {
    if (profile.active === false) {
      await supabase.auth.signOut()
      redirect('/login?error=Seu usuário está desativado. Entre em contato com o suporte.')
    }

    if (profile.role !== 'SMS_ADMIN' && profile.clinic && !(profile.clinic as any).active) {
      await supabase.auth.signOut()
      redirect('/login?error=Esta clínica está desativada. O acesso foi bloqueado.')
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
