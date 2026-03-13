import { UserForm } from '../UserForm'
import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function NewUserPage() {
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Usuário
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre um novo usuário para acessar o sistema.
        </p>
      </div>

      <UserForm 
        clinics={clinics || []} 
        userRole={profile.role} 
      />
    </div>
  )
}
