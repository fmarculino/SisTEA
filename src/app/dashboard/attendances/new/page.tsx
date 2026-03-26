import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { AttendanceForm } from '../AttendanceForm'

export default async function NewAttendancePage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Buscando os dados necessários para os selects do formulário
  // Se for CLINIC_USER, pacientes e profissionais já são da sua clínica. 
  // O formulário fará o filtro final no client ou podemos enviar a lista já filtrada aqui.
  // Vamos enviar tudo que for relevante.

  let patientsQuery = supabase.from('patients').select('id, name, clinic_id').order('name')
  
  // Use professional_clinics for many-to-many join, and professional_specialties for specialties
  let profSelect = 'id, name, professional_specialties(specialties(name)), professional_clinics(clinic_id)'
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    profSelect = 'id, name, professional_specialties(specialties(name)), professional_clinics!inner(clinic_id)'
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
    supabase.from('procedures').select('id, name, code, valor_total, active').eq('active', true).order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name').order('name') : Promise.resolve({ data: [] })
  ])

  // Mapeando dados dos profissionais para incluir o nome da especialidade
  const professionals = (professionalsRaw as any[])?.map(p => {
    const specialtyNames = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialties?.name
    ).filter(Boolean)
    return {
      id: p.id,
      name: p.name,
      professional_clinics: p.professional_clinics,
      specialty: specialtyNames?.length > 0 ? specialtyNames.join(', ') : 'Sem especialidade'
    }
  })

  // Mapeando dados dos procedimentos para as expectativas do formulário
  const mappedProcedures = procedures?.map(p => ({
    ...p,
    default_value: p.valor_total // Mapeia valor_total para default_value esperado pelo form
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Atendimento
        </h2>
      </div>
      <AttendanceForm 
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
