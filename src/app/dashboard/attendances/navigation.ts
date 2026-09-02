import { AttendanceNavData } from './AttendanceNavToolbar'

export async function getAttendanceNavigation(
  supabase: any,
  currentId: string,
  queryParams: {
    q?: string;
    professional?: string;
    procedure?: string;
    clinic?: string;
    show_unvalidated?: string;
    page?: string;
    [key: string]: any;
  }
): Promise<AttendanceNavData> {
  const showUnvalidated = queryParams.show_unvalidated !== 'false'

  // Build query to retrieve matching attendance IDs
  let selectFields = 'id, attendance_date, created_at'
  if (!showUnvalidated) {
    selectFields += ', validated_sessions:attendance_sessions!inner(id, validated_at)'
  }

  let query = supabase.from('attendances').select(selectFields)

  // 1. Apply Search Filter
  if (queryParams.q && queryParams.q.trim()) {
    const rawSearch = queryParams.q.trim()
    const terms = rawSearch.split(/\s+/).filter(Boolean)
    const cleanDigits = rawSearch.replace(/\D/g, '')

    // Match patient IDs
    let patientNameQuery = supabase.from('patients').select('id')
    terms.forEach((term: string) => {
      patientNameQuery = patientNameQuery.ilike('name', `%${term}%`)
    })
    const { data: matchedPatientsByName } = await patientNameQuery

    let matchedPatientsByDoc: any[] = []
    if (cleanDigits.length >= 3) {
      const { data } = await supabase
        .from('patients')
        .select('id')
        .or(`cns_patient.ilike."%${cleanDigits}%",cpf.ilike."%${cleanDigits}%"`)
      matchedPatientsByDoc = data || []
    }

    // Match professional IDs
    let profNameQuery = supabase.from('professionals').select('id')
    terms.forEach((term: string) => {
      profNameQuery = profNameQuery.ilike('name', `%${term}%`)
    })
    const { data: matchedProfessionalsByName } = await profNameQuery

    let matchedProfessionalsByDoc: any[] = []
    if (cleanDigits.length >= 3) {
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .or(`cns.ilike."%${cleanDigits}%",cpf.ilike."%${cleanDigits}%"`)
      matchedProfessionalsByDoc = data || []
    }

    const patientIds = Array.from(new Set([
      ...(matchedPatientsByName?.map((p: any) => p.id) || []),
      ...(matchedPatientsByDoc?.map((p: any) => p.id) || [])
    ]))

    const professionalIds = Array.from(new Set([
      ...(matchedProfessionalsByName?.map((p: any) => p.id) || []),
      ...(matchedProfessionalsByDoc?.map((p: any) => p.id) || [])
    ]))

    const orConditions: string[] = []
    if (patientIds.length > 0) {
      orConditions.push(`patient_id.in.(${patientIds.map(id => `"${id}"`).join(',')})`)
    }
    if (professionalIds.length > 0) {
      orConditions.push(`professional_id.in.(${professionalIds.map(id => `"${id}"`).join(',')})`)
    }
    if (cleanDigits.length >= 3) {
      orConditions.push(`auth_number.ilike."%${cleanDigits}%"`)
    } else if (rawSearch.length >= 2) {
      orConditions.push(`auth_number.ilike."%${rawSearch}%"`)
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','))
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  // 2. Apply dropdown filters
  if (queryParams.professional && queryParams.professional !== 'all') {
    query = query.eq('professional_id', queryParams.professional)
  }
  if (queryParams.procedure && queryParams.procedure !== 'all') {
    query = query.eq('procedure_id', queryParams.procedure)
  }
  if (queryParams.clinic && queryParams.clinic !== 'all') {
    query = query.eq('clinic_id', queryParams.clinic)
  }

  // 3. Filter unvalidated if necessary
  if (!showUnvalidated) {
    query = query.not('validated_sessions.validated_at', 'is', null)
  }

  const { data: matchedRows } = await query
    .order('attendance_date', { ascending: false })
    .order('created_at', { ascending: false })

  const ids: string[] = (matchedRows || []).map((r: any) => r.id)
  const currentIndex = ids.indexOf(currentId)

  // Build query string for navigation links
  const searchParamsObj = new URLSearchParams()
  let activeFilterCount = 0

  if (queryParams.q) {
    searchParamsObj.set('q', queryParams.q)
    activeFilterCount++
  }
  if (queryParams.professional && queryParams.professional !== 'all') {
    searchParamsObj.set('professional', queryParams.professional)
    activeFilterCount++
  }
  if (queryParams.procedure && queryParams.procedure !== 'all') {
    searchParamsObj.set('procedure', queryParams.procedure)
    activeFilterCount++
  }
  if (queryParams.clinic && queryParams.clinic !== 'all') {
    searchParamsObj.set('clinic', queryParams.clinic)
    activeFilterCount++
  }
  if (queryParams.show_unvalidated === 'false') {
    searchParamsObj.set('show_unvalidated', 'false')
    activeFilterCount++
  }
  if (queryParams.page && queryParams.page !== '1') {
    searchParamsObj.set('page', queryParams.page)
  }

  const queryString = searchParamsObj.toString()
  const backUrl = `/dashboard/attendances${queryString ? `?${queryString}` : ''}`

  return {
    prevId: currentIndex > 0 ? ids[currentIndex - 1] : null,
    nextId: currentIndex >= 0 && currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null,
    currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
    totalCount: ids.length,
    backUrl,
    queryString,
    activeSearch: queryParams.q || null,
    activeFilterCount
  }
}
