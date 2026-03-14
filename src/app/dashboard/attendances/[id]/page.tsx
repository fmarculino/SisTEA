import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { AttendanceForm } from '../AttendanceForm'
import { notFound } from 'next/navigation'

export default async function EditAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  const supabase = await createClient()
  const { id } = await params

  const { data: attendance } = await supabase.from('attendances').select('*').eq('id', id).single()
  if (!attendance) notFound()

  // Buscando os dados necessários para os selects do formulário
  let patientsQuery = supabase.from('patients').select('id, name, clinic_id').order('name')
  let professionalsQuery = supabase.from('professionals').select('id, name, specialty, clinic_id').order('name')
  
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    patientsQuery = patientsQuery.eq('clinic_id', profile.clinic_id)
    professionalsQuery = professionalsQuery.eq('clinic_id', profile.clinic_id)
  }

  const [
    { data: patients },
    { data: professionals },
    { data: procedures },
    { data: clinics },
  ] = await Promise.all([
    patientsQuery,
    professionalsQuery,
    supabase.from('procedures').select('id, name, default_value, active').order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name').order('name') : Promise.resolve({ data: [] })
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Atendimento
        </h2>
      </div>
      <AttendanceForm 
        id={attendance.id}
        initialData={attendance}
        patients={patients || []}
        professionals={professionals || []}
        procedures={procedures || []}
        clinics={clinics || []}
        userClinicId={profile?.clinic_id}
        userRole={profile?.role || ''}
      />
    </div>
  )
}
