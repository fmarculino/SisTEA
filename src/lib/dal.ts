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

  // Carregar clínicas vinculadas via user_clinics (multi-unidade)
  const { data: userClinics } = await supabase
    .from('user_clinics')
    .select('clinic_id, is_default, clinic:clinics(id, name, active, logo_url, parent_clinic_id)')
    .eq('user_id', auth.user.id)
    .order('is_default', { ascending: false })

  const linkedClinics = (userClinics || []).map((uc: any) => ({
    clinic_id: uc.clinic_id,
    is_default: uc.is_default,
    name: uc.clinic?.name,
    active: uc.clinic?.active,
    logo_url: uc.clinic?.logo_url,
    parent_clinic_id: uc.clinic?.parent_clinic_id,
  }))

  // Clínica default: primeiro a marcada como default, depois a do campo legado
  const defaultClinic = linkedClinics.find((c: any) => c.is_default) || linkedClinics[0]
  const effectiveClinicId = defaultClinic?.clinic_id || profile.clinic_id

  return { 
    ...auth.user, 
    role: profile.role, 
    clinic_id: effectiveClinicId, 
    clinic_name: defaultClinic?.name || profile.clinic?.name,
    clinic_logo_url: defaultClinic?.logo_url || profile.clinic?.logo_url,
    clinic_active: profile.role === 'SMS_ADMIN' ? true : (defaultClinic?.active ?? profile.clinic?.active ?? true),
    active: profile.active,
    linked_clinics: linkedClinics,
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

