import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ShieldCheck, Search } from 'lucide-react'
import { DataTableFilters } from '@/components/ui/DataTableFilters'
import { AuditLogList } from './AuditLogList'
import { Pagination } from '@/components/ui/Pagination'
import { DateRangeFilter } from './DateRangeFilter'

import { ExportAuditButton } from './ExportAuditButton'
import { ExportAuditPDFButton } from './ExportAuditPDFButton'

export const dynamic = 'force-dynamic'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { 
    q?: string; 
    clinic?: string; 
    action?: string; 
    table?: string;
    page?: string;
    limit?: string;
    startDate?: string;
    endDate?: string;
  }
}) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const queryParams = await searchParams
  const supabase = await createClient()

  // Pagination defaults
  const page = Number(queryParams.page) || 1
  const limit = Number(queryParams.limit) || 25
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Fetch clinics for filter
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const extraFilters = [
    {
      paramName: 'action',
      placeholder: 'Todas Ações',
      options: [
        { value: 'CREATE', label: 'Criação (CREATE)' },
        { value: 'UPDATE', label: 'Alteração (UPDATE)' },
        { value: 'DELETE', label: 'Exclusão (DELETE)' },
        { value: 'LOGIN', label: 'Acesso (LOGIN)' },
        { value: 'LOGOUT', label: 'Saída (LOGOUT)' },
      ],
    },
    {
      paramName: 'table',
      placeholder: 'Todos Recursos',
      options: [
        { value: 'patients', label: 'Pacientes' },
        { value: 'professionals', label: 'Profissionais' },
        { value: 'attendances', label: 'Atendimentos' },
        { value: 'attendance_sessions', label: 'Sessões/Frequências' },
        { value: 'users', label: 'Usuários' },
        { value: 'clinics', label: 'Clínicas' },
      ],
    },
    {
      paramName: 'clinic',
      placeholder: 'Todas Clínicas',
      options: clinics?.map((c: any) => ({ value: c.id, label: c.name })) || [],
    },
  ]

  // Main query for audit logs
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply filters
  if (queryParams.action && queryParams.action !== 'all') {
    query = query.eq('action', queryParams.action)
  }

  if (queryParams.table && queryParams.table !== 'all') {
    query = query.eq('table_name', queryParams.table)
  }

  if (queryParams.startDate) {
    query = query.gte('created_at', `${queryParams.startDate}T00:00:00`)
  }

  if (queryParams.endDate) {
    query = query.lte('created_at', `${queryParams.endDate}T23:59:59`)
  }

  if (queryParams.q) {
    // Supabase search is limited, for production consider Full Text Search
    // Here we use or filter but it might be heavy for many rows
    query = query.or(`description.ilike.%${queryParams.q}%,user_email.ilike.%${queryParams.q}%`)
  }

  const { data: logs, count } = await query.range(from, to)

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            Auditoria Digital
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro imutável de todas as ações e alterações realizadas no sistema.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportAuditPDFButton data={logs || []} />
          <ExportAuditButton data={logs || []} />
        </div>
      </div>

      <div className="bg-card/30 p-4 rounded-3xl border border-border/40 backdrop-blur-xl space-y-4">
        <div className="flex flex-col xl:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <DataTableFilters 
              placeholder="Pesquisar por descrição, usuário ou ação..." 
              showStatus={false}
              className="mb-0"
              extraFilters={extraFilters}
            />
          </div>
          <div className="xl:w-auto w-full pt-4 xl:pt-0 xl:border-l xl:border-border/10 xl:pl-4">
            <DateRangeFilter />
          </div>
        </div>
      </div>

      <div className="bg-card/50 rounded-3xl border border-border/40 overflow-hidden shadow-xl shadow-black/20">
        <AuditLogList logs={logs || []} />
        
        {count && count > 0 && (
          <div className="bg-muted/10 border-t border-border/10">
            <Pagination 
              totalItems={count || 0}
              itemsPerPage={limit}
              currentPage={page}
            />
          </div>
        )}
      </div>
    </div>
  )
}
