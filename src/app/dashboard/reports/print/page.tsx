import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import PrintReportClient from './PrintReportClient'
import { redirect } from 'next/navigation'

export default async function PrintReportPage({
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
  }>
}) {
  const params = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) redirect('/login')

  // Use a very high limit for printing to get all data
  const limit = 10000 
  const offset = 0

  let startDate = params.start_date || ''
  let endDate = params.end_date || ''
  const selectedCompetenceId = params.competence_id || ''

  if (selectedCompetenceId && (!params.start_date || !params.end_date)) {
    const { data: comp } = await supabase.from('competences').select('*').eq('id', selectedCompetenceId).single()
    if (comp) {
      const { data: clinic } = await supabase.from('clinics').select('closing_day').eq('id', comp.clinic_id || params.clinic_id || profile.clinic_id).single()
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
  const mode = params.mode || 'official'

  const selectedClinic = profile.role === 'CLINIC_USER' ? profile.clinic_id : (params.clinic_id || null)
  const selectedProfessional = params.professional_id && params.professional_id !== '' ? params.professional_id : null
  const selectedPatient = params.patient_id && params.patient_id !== '' ? params.patient_id : null
  const selectedProcedure = params.procedure_id && params.procedure_id !== '' ? params.procedure_id : null

  // Names for the header
  let clinicName = ''
  let professionalName = ''
  let patientName = ''
  let procedureName = ''

  const fetchNames = []
  if (selectedClinic) fetchNames.push(supabase.from('clinics').select('name').eq('id', selectedClinic).single())
  if (selectedProfessional) fetchNames.push(supabase.from('professionals').select('name').eq('id', selectedProfessional).single())
  if (selectedPatient) fetchNames.push(supabase.from('patients').select('name').eq('id', selectedPatient).single())
  if (selectedProcedure) fetchNames.push(supabase.from('procedures').select('name').eq('id', selectedProcedure).single())

  const nameResults = await Promise.all(fetchNames)
  let nameIdx = 0
  if (selectedClinic) { clinicName = nameResults[nameIdx++]?.data?.name; }
  if (selectedProfessional) { professionalName = nameResults[nameIdx++]?.data?.name; }
  if (selectedPatient) { patientName = nameResults[nameIdx++]?.data?.name; }
  if (selectedProcedure) { procedureName = nameResults[nameIdx++]?.data?.name; }

  let reportData: any[] = []

  if (reportType === 'billing') {
    const { data } = await supabase.rpc('get_billing_report', {
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
    reportData = data?.data || []
  } else if (reportType === 'performance') {
    const { data } = await supabase.rpc('get_performance_report', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_clinic_id: selectedClinic,
      p_limit: limit,
      p_offset: offset
    })
    reportData = data?.data || []
  } else if (reportType === 'consistency') {
    const { data } = await supabase.rpc('get_consistency_report', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_clinic_id: selectedClinic,
      p_limit: limit,
      p_offset: offset
    })
    reportData = data?.data || []
  }

  return (
    <PrintReportClient 
      data={reportData}
      type={reportType}
      startDate={startDate}
      endDate={endDate}
      clinicName={clinicName}
      professionalName={professionalName}
      patientName={patientName}
      procedureName={procedureName}
      mode={mode}
    />
  )
}
