import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { PatientForm } from '../PatientForm'
import { notFound, redirect } from 'next/navigation'

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { id } = await params
  
  const { data: patient } = await supabase
    .from('patients')
    .select('*, patient_clinics(clinic_id, active, clinics(name))')
    .eq('id', id)
    .single()
  if (!patient) notFound()

  let clinics: any[] = []
  if (profile.role === 'SMS_ADMIN' || profile.role === 'GERENTE') {
    const { data } = await supabase.from('clinics').select('id, name').order('name')
    clinics = data || []
  }

  // Only pass auth_token to admin users
  const authToken = profile.role === 'SMS_ADMIN' ? patient.auth_token : null

  // Map patient_clinics to a simpler format for the form
  const linkedClinics: { clinic_id: string; name: string; active: boolean }[] = (patient.patient_clinics || []).map((pc: any) => ({
    clinic_id: pc.clinic_id,
    name: pc.clinics?.name || 'Clínica desconhecida',
    active: pc.active
  }))

  // Determine the 'active' status for the current context (clinic user or default)
  const currentLink = profile.clinic_id 
    ? linkedClinics.find(lc => lc.clinic_id === profile.clinic_id)
    : null;
  
  if (currentLink) {
    patient.active = currentLink.active;
  }

  const patientData = {
    ...patient,
    clinic_ids: linkedClinics.map(lc => lc.clinic_id)
  };

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
        initialData={patientData}
        clinics={clinics} 
        userRole={profile.role} 
        userClinicId={profile.clinic_id}
        authToken={authToken}
        linkedClinics={linkedClinics}
      />
    </div>
  )
}
