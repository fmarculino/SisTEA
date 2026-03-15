import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { PatientForm } from '../PatientForm'
import { redirect } from 'next/navigation'

export default async function NewPatientPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  
  let clinics: any[] = []
  if (profile.role === 'SMS_ADMIN') {
    const { data } = await supabase.from('clinics').select('id, name').order('name')
    clinics = data || []
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Novo <span className="text-primary tracking-tighter">Paciente</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Cadastre um novo beneficiário no sistema. Certifique-se de vincular o paciente à clínica correta para acompanhamento.
        </p>
      </div>
      <PatientForm 
        clinics={clinics} 
        userRole={profile.role} 
        userClinicId={profile.clinic_id} 
      />
    </div>
  )
}
