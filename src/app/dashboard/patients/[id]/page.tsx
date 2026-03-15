import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { PatientForm } from '../PatientForm'
import { notFound, redirect } from 'next/navigation'

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { id } = await params
  
  const { data: patient } = await supabase.from('patients').select('*').eq('id', id).single()
  if (!patient) notFound()

  let clinics: any[] = []
  if (profile.role === 'SMS_ADMIN') {
    const { data } = await supabase.from('clinics').select('id, name').order('name')
    clinics = data || []
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Editar <span className="text-primary tracking-tighter">Paciente</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Atualize as informações cadastrais e de contato do paciente. Os dados de prontuário são preservados.
        </p>
      </div>
      <PatientForm 
        id={patient.id}
        initialData={patient}
        clinics={clinics} 
        userRole={profile.role} 
        userClinicId={profile.clinic_id} 
      />
    </div>
  )
}
