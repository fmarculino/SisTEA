import 'server-only'
import { createClient } from '@/utils/supabase/server'

export async function getUserProfile() {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()

  if (authError || !auth?.user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .single()

  return { ...auth.user, role: profile.role, clinic_id: profile.clinic_id, active: profile.active }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
