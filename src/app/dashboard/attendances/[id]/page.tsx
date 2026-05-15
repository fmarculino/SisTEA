import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { AttendanceForm } from '../AttendanceForm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0


export default async function EditAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  const supabase = await createClient()
  const { id } = await params

  const { data: attendance } = await supabase
    .from('attendances')
    .select(`
      *, 
      sessions:attendance_sessions(*),
      patient:patients(id, name, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color),
      professional:professionals(id, name, cns, professional_specialties(specialty_id, specialties(name, cbo))),
      procedure:procedures(id, name, code, valor_total)
    `)
    .eq('id', id)
    .single()
  
  if (!attendance) notFound()

  // Mapeando dados do profissional do atendimento (caso precise de fallback)
  if (attendance.professional) {
    const p = attendance.professional as any
    const specialtyNames = p.professional_specialties?.map((ps: any) => ps.specialties?.name).filter(Boolean)
    const cbos = p.professional_specialties?.map((ps: any) => ps.specialties?.cbo).filter(Boolean)
    
    attendance.professional_data = {
      ...p,
      cbo: cbos?.length > 0 ? cbos[0] : '',
      specialty: specialtyNames?.length > 0 ? specialtyNames.join(', ') : ''
    }
  }


  // Buscando os dados necessários para os selects e para a geração do PDF
  let patientsQuery = supabase.from('patients').select('id, name, clinic_id, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color').order('name')
  
  // Use professional_clinics for many-to-many join, and professional_specialties for specialties
  let profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics(clinic_id)'
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics!inner(clinic_id)'
  }

  let professionalsQuery = supabase
    .from('professionals')
    .select(profSelect)
    .order('name')
  
  // No Edit, não filtramos por clinic_id para garantir que o paciente/profissional do atendimento
  // seja encontrado mesmo que tenha sido cadastrado em outra unidade ou tenha mudado de unidade.
  // A própria consulta do atendimento já garante a segurança do acesso.


  const [
    { data: patients },
    { data: professionalsRaw },
    { data: procedures },
    { data: clinics },
    { data: settings }
  ] = await Promise.all([
    patientsQuery,
    professionalsQuery,
    supabase.from('procedures').select('id, name, code, active, valor_total, min_age, max_age, max_quantity, procedure_specialties(specialty_id)').order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name, cnes').order('name') : supabase.from('clinics').select('id, name, cnes').eq('id', profile?.clinic_id || '').order('name'),
    supabase.from('system_settings').select('key, value').eq('key', 'system_timezone').single()
  ])

  const systemTimezone = settings?.value || 'America/Sao_Paulo'

  // Mapeando dados dos profissionais para incluir o nome da especialidade e CBO
  const professionals = (professionalsRaw as any[])?.map(p => {
    const specialtyNames = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialties?.name
    ).filter(Boolean)
    
    const cbos = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialties?.cbo
    ).filter(Boolean)

    const specialtyIds = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialty_id
    ).filter(Boolean)

    const specialtiesFull = (p.professional_specialties as any[])?.map((ps: any) => ({
      id: ps.specialty_id,
      name: ps.specialties?.name,
      cbo: ps.specialties?.cbo
    })).filter((s: any) => s.id)

    return {
      id: p.id,
      name: p.name,
      cns: p.cns,
      cbo: cbos?.length > 0 ? cbos[0] : '',
      professional_clinics: p.professional_clinics,
      specialty_ids: specialtyIds,
      specialties_full: specialtiesFull,
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
          Editar Atendimento
        </h2>
      </div>
      <AttendanceForm 
        id={attendance.id}
        initialData={attendance}
        patients={patients || []}
        professionals={professionals || []}
        procedures={mappedProcedures || []}
        clinics={clinics || []}
        userClinicId={profile?.clinic_id}
        userRole={profile?.role || ''}
        systemTimezone={systemTimezone}
      />
    </div>
  )
}
