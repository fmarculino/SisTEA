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
    .select('*, clinic:clinics(name, active, logo_url)')
    .eq('id', auth.user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile for ID:', auth.user.id, profileError)
  }

  if (!profile) {
    return null
  }

  return { 
    ...auth.user, 
    role: profile.role, 
    clinic_id: profile.clinic_id, 
    clinic_name: profile.clinic?.name,
    clinic_logo_url: profile.clinic?.logo_url,
    clinic_active: profile.role === 'SMS_ADMIN' ? true : (profile.clinic?.active ?? true),
    active: profile.active 
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export async function getActiveTerm() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('terms_versions')
    .select('id, version, content')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching active terms_version:', error)
    return null
  }
  return data
}

export async function hasAcceptedTerm(userId: string, termVersionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('term_version_id', termVersionId)
    .maybeSingle()

  if (error) {
    console.error('Error checking term acceptance:', error)
    return false
  }
  return !!data
}

