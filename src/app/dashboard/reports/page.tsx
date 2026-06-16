import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    competence_id?: string;
    start_date?: string; 
    end_date?: string; 
    type?: string; 
    clinic_id?: string;
    professional_id?: string;
    patient_id?: string;
    procedure_id?: string;
    mode?: 'official' | 'preview' | 'all';
    page?: string;
    limit?: string;
  }>
}) {
  const params = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Pagination Logic
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 20
  const offset = (page - 1) * limit

  const isClinicUser = !['SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR'].includes(profile?.role || '')

  let clinicsQuery = supabase.from('clinics').select('id, name, closing_day').order('name')
  let patientsQuery = supabase.from('patients').select('id, name').order('name')
  let competencesQuery = supabase.from('competences').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(24)

  if (isClinicUser && profile?.clinic_id) {
    clinicsQuery = clinicsQuery.eq('id', profile.clinic_id)
    patientsQuery = patientsQuery.eq('clinic_id', profile.clinic_id)
    competencesQuery = competencesQuery.eq('clinic_id', profile.clinic_id)
  }

  // Fetch filter options
  const [clinicsRes, professionalsRes, patientsRes, proceduresRes, competencesRes] = await Promise.all([
    clinicsQuery,
    supabase.from('professionals').select('id, name').order('name'),
    patientsQuery,
    supabase.from('procedures').select('id, code, name').order('name'),
    competencesQuery
  ])

  const clinics = clinicsRes.data || []
  const competences = competencesRes.data || []

  // Logic for dates
  let startDate = params.start_date || ''
  let endDate = params.end_date || ''
  const selectedCompetenceId = params.competence_id || ''

  if (selectedCompetenceId && (!params.start_date || !params.end_date)) {
    const comp = competences.find(c => c.id === selectedCompetenceId)
    if (comp) {
      const clinicId = comp.clinic_id || params.clinic_id || profile?.clinic_id
      const clinic = clinics.find(c => c.id === clinicId)
      const closingDay = clinic?.closing_day || 25
      const end = new Date(comp.year, comp.month - 1, closingDay)
      const start = new Date(comp.year, comp.month - 2, closingDay + 1)
      startDate = start.toISOString().split('T')[0]
      endDate = end.toISOString().split('T')[0]
    }
  }

  if (!startDate || !endDate) {
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  }

  const reportType = (params.type as any) || 'billing'
  const mode = params.mode || 'preview'

  const selectedClinic = isClinicUser ? profile?.clinic_id : (params.clinic_id || null)
  const selectedProfessional = params.professional_id && params.professional_id !== '' ? params.professional_id : null
  const selectedPatient = params.patient_id && params.patient_id !== '' ? params.patient_id : null
  const selectedProcedure = params.procedure_id && params.procedure_id !== '' ? params.procedure_id : null

  // Fetch initial data based on type
  let reportData: any[] = []
  let totalCount = 0

  if (reportType === 'billing') {
    const { data, error } = await supabase.rpc('get_billing_report', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_clinic_id: selectedClinic,
      p_professional_id: selectedProfessional,
      p_patient_id: selectedPatient,
      p_procedure_id: selectedProcedure,
      p_mode: mode,
      p_limit: limit,
      p_offset: offset
    })
    if (error) console.error('RPC Error Billing:', error)
    reportData = data?.data || []
    totalCount = data?.total || 0
  } else if (reportType === 'performance') {
    const { data, error } = await supabase.rpc('get_performance_report', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_clinic_id: selectedClinic,
      p_limit: limit,
      p_offset: offset
    })
    if (error) console.error('RPC Error Performance:', error)
    reportData = data?.data || []
    totalCount = data?.total || 0
  } else if (reportType === 'consistency') {
    const { data, error } = await supabase.rpc('get_consistency_report', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_clinic_id: selectedClinic,
      p_limit: limit,
      p_offset: offset
    })
    if (error) console.error('RPC Error Consistency:', error)
    reportData = data?.data || []
    totalCount = data?.total || 0
  }

  const filters = {
    clinics,
    professionals: professionalsRes.data || [],
    patients: patientsRes.data || [],
    procedures: proceduresRes.data || [],
    competences
  }

  return (
    <ReportsClient 
      initialData={reportData}
      totalCount={totalCount}
      currentPage={page}
      itemsPerPage={limit}
      type={reportType}
      filters={filters}
      selectedCompetenceId={selectedCompetenceId}
      startDate={startDate}
      endDate={endDate}
      selectedClinic={selectedClinic || ''}
      selectedProfessional={selectedProfessional || ''}
      selectedPatient={selectedPatient || ''}
      selectedProcedure={selectedProcedure || ''}
      mode={mode}
      userRole={profile?.role || ''}
    />
  )
}
