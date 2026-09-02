import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Plus, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/utils/format'
import { DeleteAttendanceButton } from './DeleteAttendanceButton'

import { DataTableFilters } from '@/components/ui/DataTableFilters'
import { Pagination } from '@/components/ui/Pagination'

export default async function AttendancesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    professional?: string;
    procedure?: string;
    clinic?: string;
    page?: string;
    limit?: string;
    show_unvalidated?: string;
  }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  const page = Number(queryParams.page) || 1
  const limit = Number(queryParams.limit) || 20
  const from = (page - 1) * limit
  const to = from + limit - 1
  const showUnvalidated = queryParams.show_unvalidated !== 'false'

  // Fetch filter options in parallel
  const professionalQuery = supabase
    .from('professionals')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const procedureQuery = supabase
    .from('procedures')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const clinicQuery = supabase
    .from('clinics')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const results = await Promise.all([professionalQuery, procedureQuery, clinicQuery])
  const professionals = results[0].data || []
  const procedures = results[1].data || []
  const clinicsList = results[2].data || []

  // Build extra filters
  const extraFilters = [
    {
      paramName: 'professional',
      placeholder: 'Todos Profissionais',
      options: professionals.map((p: any) => ({ value: p.id, label: p.name })),
    },
    {
      paramName: 'procedure',
      placeholder: 'Todos Procedimentos',
      options: procedures.map((p: any) => ({ value: p.id, label: p.name })),
    },
  ]

  if (clinicsList.length > 0) {
    extraFilters.push({
      paramName: 'clinic',
      placeholder: 'Todas Clínicas',
      options: clinicsList.map((c: any) => ({ value: c.id, label: c.name })),
    })
  }

  // Build main query
  let selectFields = `
    id,
    attendance_date,
    auth_number,
    value_applied,
    patient:patients(name),
    professional:professionals(name),
    procedure:procedures(name),
    clinic:clinics(name),
    sessions:attendance_sessions(id, status, validated_at)
  `

  if (!showUnvalidated) {
    selectFields += `,
    validated_sessions:attendance_sessions!inner(id, validated_at)`
  }

  let query = supabase
    .from('attendances')
    .select(selectFields, { count: 'exact' })

  // Apply Search Filter (Paciente, Profissional ou Nº da Guia)
  if (queryParams.q && queryParams.q.trim()) {
    const rawSearch = queryParams.q.trim()
    const terms = rawSearch.split(/\s+/).filter(Boolean)
    const cleanDigits = rawSearch.replace(/\D/g, '')

    // 1. Fetch matching patient IDs (all words must match patient name, e.g. "samuel" AND "alves")
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

    // 2. Fetch matching professional IDs (all words must match professional name)
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
      // Force empty result if nothing matched the search
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  // Apply dropdown filters
  if (queryParams.professional && queryParams.professional !== 'all') {
    query = query.eq('professional_id', queryParams.professional)
  }
  if (queryParams.procedure && queryParams.procedure !== 'all') {
    query = query.eq('procedure_id', queryParams.procedure)
  }
  if (queryParams.clinic && queryParams.clinic !== 'all') {
    query = query.eq('clinic_id', queryParams.clinic)
  }

  // Filter out unvalidated attendances if not showUnvalidated
  if (!showUnvalidated) {
    query = query.not('validated_sessions.validated_at', 'is', null)
  }

  const { data: attendances, count, error: fetchError } = await query
    .order('attendance_date', { ascending: false })
    .range(from, to)

  if (fetchError) {
    console.error('Erro ao buscar atendimentos:', fetchError)
  }

  const currentParams = new URLSearchParams()
  if (queryParams.q) currentParams.set('q', queryParams.q)
  if (queryParams.professional && queryParams.professional !== 'all') currentParams.set('professional', queryParams.professional)
  if (queryParams.procedure && queryParams.procedure !== 'all') currentParams.set('procedure', queryParams.procedure)
  if (queryParams.clinic && queryParams.clinic !== 'all') currentParams.set('clinic', queryParams.clinic)
  if (queryParams.show_unvalidated === 'false') currentParams.set('show_unvalidated', 'false')
  if (queryParams.page && queryParams.page !== '1') currentParams.set('page', queryParams.page)
  const queryString = currentParams.toString()
  const editQuerySuffix = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Atendimentos (Apontamento de Frequência)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre e visualize as sessões de fonoaudiologia e outros procedimentos.
          </p>
        </div>
        <Link
          href="/dashboard/attendances/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" />
          Novo Registro
        </Link>
      </div>

      <DataTableFilters 
        placeholder="Pesquisar por paciente, profissional ou nº da guia..." 
        showStatus={false}
        extraFilters={extraFilters}
        checkboxFilter={{
          paramName: 'show_unvalidated',
          label: 'Exibir sem validação',
          defaultValue: true
        }}
      />
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="min-w-full divide-y divide-border/40">
            <thead>
              <tr className="bg-muted/30">
                <th scope="col" className="py-4 pl-6 pr-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Data</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Paciente</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Profissional</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Procedimento</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Clínica</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Sessões</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right pr-6">Valor</th>
                <th scope="col" className="relative py-4 pl-3 pr-6">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 bg-card">
              {attendances?.map((att: any) => {
                const sessionsCount = att.sessions?.length || 0
                const doneSessions = att.sessions?.filter((s: any) => s.status === 'Realizada').length || 0

                return (
                  <tr key={att.id} className="group hover:bg-muted/20 transition-colors duration-200 relative">
                    <td className="whitespace-nowrap py-5 pl-6 pr-3 text-sm font-semibold text-foreground">
                      <Link
                        href={`/dashboard/attendances/${att.id}/edit${editQuerySuffix}`}
                        className="absolute inset-0 z-0"
                      />
                      <span className="relative z-10">
                        {format(new Date(att.attendance_date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm font-medium text-foreground/90 max-w-[200px]">
                      <div className="truncate">{att.patient?.name || '-'}</div>
                      {att.auth_number && (
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          Guia: <span className="text-foreground/80 font-medium">{att.auth_number}</span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground group-hover:text-foreground transition-colors max-w-[150px] truncate">
                      {att.professional?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground truncate max-w-[150px]">
                      {att.procedure?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground max-w-[200px] truncate">
                      {att.clinic?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/5 text-primary border border-primary/10">
                        {doneSessions} / {sessionsCount} <span className="ml-1 opacity-70">Sessões</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm font-bold text-foreground text-right pr-6">
                      {formatCurrency(att.value_applied)}
                    </td>
                    <td className="whitespace-nowrap py-5 pl-3 pr-6 text-right text-sm font-medium relative z-10">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/attendances/${att.id}/edit${editQuerySuffix}`}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                          title="Editar Atendimento"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        
                        {/* Show delete button if NO validated session exists (Realizada or Glosado) */}
                        {!att.sessions?.some((s: any) => s.status === 'Realizada' || s.status === 'Glosado') && (
                          <DeleteAttendanceButton id={att.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(!attendances || attendances.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground italic">
                    Nenhum atendimento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={count || 0} itemsPerPage={limit} currentPage={page} />
      </div>
    </div>
  )
}
