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
  
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Fetch the user to edit
  const { data: userToEdit } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!userToEdit) {
    notFound()
  }

  // Fetch clinics for the dropdown
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name')
    .order('name')

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
        initialData={userToEdit} 
        clinics={clinics || []} 
        userRole={profile.role} 
      />
    </div>
  )
}
