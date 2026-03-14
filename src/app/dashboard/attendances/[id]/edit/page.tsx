import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { notFound } from 'next/navigation'
import { AttendanceForm } from '../../AttendanceForm'

export default async function EditAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Fetch individual attendance data
  const { data: attendance } = await supabase
    .from('attendances')
    .select('*, sessions:attendance_sessions(*)')
    .eq('id', id)
    .single()

  if (!attendance) {
    notFound()
  }

  // Fetch lookup data for selects
  let patientsQuery = supabase.from('patients').select('id, name, clinic_id').order('name')
  
  // Use professional_clinics for many-to-many join
  let profSelect = 'id, name, specialties(name), professional_clinics(clinic_id)'
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    profSelect = 'id, name, specialties(name), professional_clinics!inner(clinic_id)'
  }

  let professionalsQuery = supabase
    .from('professionals')
    .select(profSelect)
    .order('name')
  
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    patientsQuery = patientsQuery.eq('clinic_id', profile.clinic_id)
    professionalsQuery = professionalsQuery.eq('professional_clinics.clinic_id', profile.clinic_id)
  }

  const [
    { data: patients },
    { data: professionalsRaw },
    { data: procedures },
    { data: clinics },
  ] = await Promise.all([
    patientsQuery,
    professionalsQuery,
    supabase.from('procedures').select('id, name, valor_total, active').eq('active', true).order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name').order('name') : Promise.resolve({ data: [] })
  ])

  // Mapeando dados dos profissionais para incluir o nome da especialidade
  const professionals = (professionalsRaw as any[])?.map(p => ({
    id: p.id,
    name: p.name,
    professional_clinics: p.professional_clinics,
    specialty: (p.specialties as any)?.name || 'Sem especialidade'
  }))

  // Mapeando dados dos procedimentos para as expectativas do formulário
  const mappedProcedures = procedures?.map(p => ({
    ...p,
    default_value: p.valor_total
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Atendimento
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize os dados do atendimento selecionado.
        </p>
      </div>

      <AttendanceForm
        id={id}
        initialData={attendance}
        patients={patients || []}
        professionals={professionals || []}
        procedures={mappedProcedures || []}
        clinics={clinics || []}
        userClinicId={profile?.clinic_id}
        userRole={profile?.role || ''}
      />
    </div>
  )
}
