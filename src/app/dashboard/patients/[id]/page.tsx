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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Paciente
        </h2>
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
