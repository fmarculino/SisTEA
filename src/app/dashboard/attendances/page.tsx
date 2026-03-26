import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Plus, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/utils/format'
import { DeleteAttendanceButton } from './DeleteAttendanceButton'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function AttendancesPage({
  searchParams,
}: {
  searchParams: { q?: string; professional?: string; procedure?: string; clinic?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Fetch filter options in parallel
  const isAdmin = profile?.role === 'SMS_ADMIN'

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

  const queries: PromiseLike<any>[] = [professionalQuery, procedureQuery]

  if (isAdmin) {
    const clinicQuery = supabase
      .from('clinics')
      .select('id, name')
      .eq('active', true)
      .order('name')
    queries.push(clinicQuery)
  }

  const results = await Promise.all(queries)
  const professionals = results[0].data || []
  const procedures = results[1].data || []
  const clinics = isAdmin ? (results[2]?.data || []) : []

  // Build extra filters
  const extraFilters: { paramName: string; placeholder: string; options: { value: string; label: string }[] }[] = [
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

  if (isAdmin) {
    extraFilters.push({
      paramName: 'clinic',
      placeholder: 'Todas Clínicas',
      options: clinics.map((c: any) => ({ value: c.id, label: c.name })),
    })
  }

  // Build main query
  let query = supabase
    .from('attendances')
    .select(`
      id,
      attendance_date,
      value_applied,
      patient:patients(name),
      professional:professionals(name),
      procedure:procedures(name),
      clinic:clinics(name),
      sessions:attendance_sessions(id, status)
    `)

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`patient.name.ilike.%${queryParams.q}%,professional.name.ilike.%${queryParams.q}%`)
  }

  // Apply dropdown filters
  if (queryParams.professional && queryParams.professional !== 'all') {
    query = query.eq('professional_id', queryParams.professional)
  }
  if (queryParams.procedure && queryParams.procedure !== 'all') {
    query = query.eq('procedure_id', queryParams.procedure)
  }
  if (isAdmin && queryParams.clinic && queryParams.clinic !== 'all') {
    query = query.eq('clinic_id', queryParams.clinic)
  }

  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    query = query.eq('clinic_id', profile.clinic_id)
  }

  const { data: attendances } = await query.order('attendance_date', { ascending: false })

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
        placeholder="Pesquisar por paciente ou profissional..." 
        showStatus={false}
        extraFilters={extraFilters}
      />      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="min-w-full divide-y divide-border/40">
            <thead>
              <tr className="bg-muted/30">
                <th scope="col" className="py-4 pl-6 pr-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Data</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Paciente</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Profissional</th>
                <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Procedimento</th>
                {isAdmin && (
                  <th scope="col" className="px-3 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Clínica</th>
                )}
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
                  <tr key={att.id} className="group hover:bg-muted/20 transition-colors duration-200">
                    <td className="whitespace-nowrap py-5 pl-6 pr-3 text-sm font-semibold text-foreground">
                      {format(new Date(att.attendance_date + 'T00:00:00'), 'dd/MM/yyyy')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm font-medium text-foreground/90 max-w-[200px] truncate">
                      {att.patient?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground group-hover:text-foreground transition-colors max-w-[150px] truncate">
                      {att.professional?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground truncate max-w-[150px]">
                      {att.procedure?.name || '-'}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground max-w-[200px] truncate">
                        {att.clinic?.name || '-'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-5 text-sm">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/5 text-primary border border-primary/10">
                        {doneSessions} / {sessionsCount} <span className="ml-1 opacity-70">Sessões</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-5 text-sm font-bold text-foreground text-right pr-6">
                      {formatCurrency(att.value_applied)}
                    </td>
                    <td className="whitespace-nowrap py-5 pl-3 pr-6 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/attendances/${att.id}/edit`}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                          title="Editar Atendimento"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <DeleteAttendanceButton id={att.id} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(!attendances || attendances.length === 0) && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-sm text-muted-foreground italic">
                    Nenhum atendimento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
