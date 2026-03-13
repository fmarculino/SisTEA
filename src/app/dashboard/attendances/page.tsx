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
  searchParams: { q?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

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
    // Filter by patient name or professional name
    // Since Supabase join filters are complex, we'll use a simpler approach if possible
    // or filter on the client if the dataset is small. 
    // But let's try Postgres path search if supported, otherwise just name.
    query = query.or(`patient.name.ilike.%${queryParams.q}%,professional.name.ilike.%${queryParams.q}%`)
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
      />

      <div className="overflow-x-auto shadow ring-1 ring-border sm:rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground">Data</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Paciente</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Profissional</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Procedimento</th>
              {profile?.role === 'SMS_ADMIN' && (
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Clínica</th>
              )}
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Sessões</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Valor (R$)</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {attendances?.map((att: any) => {
              const sessionsCount = att.sessions?.length || 0
              const doneSessions = att.sessions?.filter((s: any) => s.status === 'Realizada').length || 0

              return (
                <tr key={att.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground">
                    {format(new Date(att.attendance_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {att.patient?.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {att.professional?.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {att.procedure?.name || '-'}
                  </td>
                  {profile?.role === 'SMS_ADMIN' && (
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                      {att.clinic?.name || '-'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20">
                      {doneSessions} / {sessionsCount} realizadas
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {formatCurrency(att.value_applied)}
                  </td>
                  <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/attendances/${att.id}/edit`}
                        className="text-primary hover:text-primary/80 transition-colors p-1"
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
                <td colSpan={8} className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum atendimento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
