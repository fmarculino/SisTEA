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

  let patientsSelect = 'id, name, clinic_id, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color, patient_clinics(clinic_id)'
  let profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics(clinic_id)'

  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    patientsSelect = 'id, name, clinic_id, cns_patient, birth_date, gender, mother_name, phone, address, city, cep, race_color, patient_clinics!inner(clinic_id)'
    profSelect = 'id, name, cns, professional_specialties(specialty_id, specialties(name, cbo)), professional_clinics!inner(clinic_id)'
  }

  let patientsQuery = supabase
    .from('patients')
    .select(patientsSelect)
    .order('name')
  
  let professionalsQuery = supabase
    .from('professionals')
    .select(profSelect)
    .order('name')
  
  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    patientsQuery = patientsQuery
      .eq('patient_clinics.clinic_id', profile.clinic_id)
      .eq('patient_clinics.active', true)
    professionalsQuery = professionalsQuery.eq('professional_clinics.clinic_id', profile.clinic_id)
  }

  const [
    { data: patients },
    { data: professionalsRaw },
    { data: procedures },
    { data: clinics },
    { data: settings },
    { data: clinicProcedurePrices }
  ] = await Promise.all([
    patientsQuery,
    professionalsQuery,
    supabase.from('procedures').select('id, name, code, valor_total, active, min_age, max_age, max_quantity, procedure_specialties(specialty_id), procedure_cid(cid_id, cid(code, name)), procedure_service_classifications(service_classifications(*))').eq('active', true).order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name, cnes').order('name') : Promise.resolve({ data: [] }),
    supabase.from('system_settings').select('key, value').eq('key', 'system_timezone').single(),
    supabase.from('clinic_procedure_prices').select('clinic_id, procedure_id, valor_total, valid_from, valid_to, active, contract_id, quantidade_contratada, quantidade_saldo').eq('active', true)
  ])

  const systemTimezone = settings?.value || 'America/Sao_Paulo'

  // Mapeando dados dos profissionais para incluir o nome da especialidade
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
    specialty_ids: (p.procedure_specialties as any[])?.map((ps: any) => ps.specialty_id),
    cid_options: (p.procedure_cid as any[])?.map((pc: any) => ({
      id: pc.cid?.code, // Usamos o código como ID para persistir no campo 'cid'
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
        systemTimezone={systemTimezone}
        clinicProcedurePrices={clinicProcedurePrices || []}
      />
    </div>
  )
}
