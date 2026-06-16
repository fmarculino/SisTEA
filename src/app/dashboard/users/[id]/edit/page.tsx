import { UserForm } from '../../UserForm'
import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect, notFound } from 'next/navigation'

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN' && profile?.role !== 'GERENTE') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Fetch the user to edit and their user_clinics
  const { data: userToEdit } = await supabase
    .from('users')
    .select('*, user_clinics(clinic_id, is_default)')
    .eq('id', id)
    .single()

  if (!userToEdit) {
    notFound()
  }

  // Fetch clinics the current logged-in user can access
  const { data: accessibleClinicIds } = await supabase.rpc('get_user_accessible_clinic_ids')

  // If GERENTE, block access if the edited user doesn't share any clinic in the manager's group
  if (profile.role === 'GERENTE') {
    const userClinicIds = (userToEdit.user_clinics || []).map((uc: any) => uc.clinic_id)
    const hasCommonClinic = userClinicIds.some((cid: string) => accessibleClinicIds?.includes(cid))
    const hasLegacyAccess = userToEdit.clinic_id && accessibleClinicIds?.includes(userToEdit.clinic_id)

    if (!hasCommonClinic && !hasLegacyAccess) {
      redirect('/dashboard/users')
    }
  }

  // Fetch clinics for the dropdown (RLS automatically filters this list for GERENTE)
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name')
    .order('name')

  // Map userToEdit to include clinic_ids and default_clinic_id
  const mappedUserClinicIds = (userToEdit.user_clinics || []).map((uc: any) => uc.clinic_id)
  const defaultClinicId = (userToEdit.user_clinics || []).find((uc: any) => uc.is_default)?.clinic_id || userToEdit.clinic_id

  const initialData = {
    ...userToEdit,
    clinic_ids: mappedUserClinicIds,
    default_clinic_id: defaultClinicId,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Usuário
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize as informações do usuário <strong>{userToEdit.email}</strong>.
        </p>
      </div>

      <UserForm 
        id={id}
        initialData={initialData} 
        clinics={clinics || []} 
        userRole={profile.role} 
        userClinicId={profile.clinic_id}
      />
    </div>
  )
}
