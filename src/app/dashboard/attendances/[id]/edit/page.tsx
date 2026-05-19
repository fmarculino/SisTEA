import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { AttendanceForm } from '../../AttendanceForm'
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
      procedure:procedures(id, name, code, valor_total, procedure_specialties(specialty_id))
    `)
    .eq('id', id)
    .single()
  
  if (!attendance) notFound()
  
  // Sort sessions chronologically by date and start time
  if (attendance.sessions) {
    attendance.sessions.sort((a: any, b: any) => {
      const dateCompare = a.session_date.localeCompare(b.session_date)
      if (dateCompare !== 0) return dateCompare
      return a.start_time.localeCompare(b.start_time)
    })
  }

  // Mapeando dados do profissional do atendimento (caso precise de fallback)
  if (attendance.professional) {
    const p = attendance.professional as any
    const specialtyNames = p.professional_specialties?.map((ps: any) => ps.specialties?.name).filter(Boolean)
    const cbos = p.professional_specialties?.map((ps: any) => ps.specialties?.cbo).filter(Boolean)
    
    const specialtyIds = p.professional_specialties?.map((ps: any) => ps.specialty_id).filter(Boolean)
    
    attendance.professional_data = {
      ...p,
      cbo: cbos?.length > 0 ? cbos[0] : '',
      specialty_ids: specialtyIds,
      specialty: specialtyNames?.length > 0 ? specialtyNames.join(', ') : ''
    }
  }


  // Buscando os dados necessários para os selects e para a geração do PDF
  let patientsSelect = 'id, name, clinic_id, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color, patient_clinics(clinic_id)'
  let profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics(clinic_id)'

  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    // Note: We use !inner only if we want to filter in the query itself.
    // In Edit, we want to see the patient/professional of the attendance even if they are not in the current filter list of the user's clinic.
    // However, for professionals, the system previously used !inner in some places.
    // For now, we fetch all associations to allow the client-side filter to work.
    patientsSelect = 'id, name, clinic_id, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color, patient_clinics(clinic_id)'
    profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics(clinic_id)'
  }

  let patientsQuery = supabase
    .from('patients')
    .select(patientsSelect)
    .order('name')
  
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
    { data: settings },
    { data: clinicConfig },
    { data: clinicProcedurePrices }
  ] = await Promise.all([
    patientsQuery,
    professionalsQuery,
    supabase.from('procedures').select('id, name, code, active, valor_total, procedure_specialties(specialty_id), procedure_cid(cid_id, cid(code, name)), procedure_service_classifications(service_classifications(*))').order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name, cnes').order('name') : supabase.from('clinics').select('id, name, cnes').eq('id', profile?.clinic_id || '').order('name'),
    supabase.from('system_settings').select('key, value').eq('key', 'system_timezone').single(),
    supabase.from('clinics').select('competence_end_day').eq('id', attendance.clinic_id).single(),
    supabase.from('clinic_procedure_prices').select('clinic_id, procedure_id, valor_total, valid_from, valid_to, active, contract_id, quantidade_contratada, quantidade_saldo').eq('active', true)
  ])

  const systemTimezone = settings?.value || 'America/Sao_Paulo'
  const endDay = clinicConfig?.competence_end_day || 31

  const dateParts = attendance.attendance_date.split('-')
  const day = parseInt(dateParts[2], 10)
  let month = parseInt(dateParts[1], 10)
  let year = parseInt(dateParts[0], 10)
  if (day > endDay && endDay < 31) {
    month += 1
    if (month > 12) {
      month = 1; year += 1;
    }
  }

  const { data: competence } = await supabase.from('competences').select('status').eq('clinic_id', attendance.clinic_id).eq('month', month).eq('year', year).maybeSingle()
  const competenceStatus = competence?.status || 'ABERTA'

  // Mapeando dados dos profissionais para incluir o nome da especialidade e CBO
  const professionals = (professionalsRaw as any[])?.map(p => {
    const specialtyNames = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialties?.name
    ).filter(Boolean)
    
    const specialtyIds = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialty_id
    ).filter(Boolean)

    const cbos = (p.professional_specialties as any[])?.map(
      (ps: any) => ps.specialties?.cbo
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
    specialty_ids: (p.procedure_specialties as any[])?.map((ps: any) => ps.specialty_id),
    cid_options: (p.procedure_cid as any[])?.map((pc: any) => ({
      id: pc.cid?.code,
      name: `${pc.cid?.code} — ${pc.cid?.name}`
    })).filter(c => c.id),
    datasus_options: (p.procedure_service_classifications as any[])?.map((psc: any) => {
      const sc = psc.service_classifications;
      if (!sc) return null;
      return {
        id: sc.id,
        name: `${sc.service_code}/${sc.classification_code} — ${sc.name}`
      };
    }).filter(Boolean),
    default_value: p.valor_total // Mapeia valor_total para default_value esperado pelo form
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
        id={attendance.id}
        initialData={attendance}
        patients={patients || []}
        professionals={professionals || []}
        procedures={mappedProcedures || []}
        clinics={clinics || []}
        userClinicId={profile?.clinic_id}
        userRole={profile?.role || ''}
        systemTimezone={systemTimezone}
        competenceStatus={competenceStatus}
        clinicProcedurePrices={clinicProcedurePrices || []}
      />
    </div>
  )
}
