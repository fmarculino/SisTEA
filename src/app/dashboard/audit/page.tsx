import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ShieldCheck, MapPin, Tablet, Globe, Search, Download, CalendarCheck } from 'lucide-react'
import { DataTableFilters } from '@/components/ui/DataTableFilters'

import { ExportAuditButton } from './ExportAuditButton'

export const dynamic = 'force-dynamic'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { q?: string; clinic?: string; action?: string; table?: string }
}) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const queryParams = await searchParams
  const supabase = await createClient()

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
    .select('*')
    .order('created_at', { ascending: false })

  if (queryParams.action && queryParams.action !== 'all') {
    query = query.eq('action', queryParams.action)
  }

  if (queryParams.table && queryParams.table !== 'all') {
    query = query.eq('table_name', queryParams.table)
  }

  const { data: logs } = await query.limit(300)

  // Client-side search for description and user
  const filteredLogs = queryParams.q 
    ? logs?.filter((log: any) => 
        log.description?.toLowerCase().includes(queryParams.q!.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(queryParams.q!.toLowerCase())
      )
    : logs

  return (
    <div className="space-y-6">
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
        <ExportAuditButton data={filteredLogs || []} />
      </div>

      <DataTableFilters 
        placeholder="Pesquisar por descrição, usuário ou ação..." 
        showStatus={false}
        extraFilters={extraFilters}
      />

      <div className="grid grid-cols-1 gap-4">
        {filteredLogs?.map((log: any) => (
          <div key={log.id} className="bento-card p-6 hover:border-primary/30 transition-all group">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main Info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border ${
                      log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      log.action === 'DELETE' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                      log.action === 'UPDATE' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-sky-500/10 text-sky-500 border-sky-500/20'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ID: {log.id.split('-')[0]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    {log.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Usuário</p>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-foreground">{log.user_email}</p>
                      <span className="px-2 py-0.5 rounded-md bg-muted text-[9px] font-bold text-muted-foreground uppercase">
                        {log.user_role === 'SMS_ADMIN' ? 'Controlador' : 'Gestor'}
                      </span>
                    </div>
                  </div>
                  {log.table_name && (
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Tabela / Recurso</p>
                      <p className="text-xs font-medium text-foreground/80 uppercase">{log.table_name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Metadata */}
              <div className="lg:w-72 bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <Globe className="h-4 w-4 text-sky-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-bold text-foreground">Endereço IP</p>
                    <p className="text-muted-foreground font-mono truncate">{log.ip_address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Tablet className="h-4 w-4 text-purple-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-bold text-foreground">Dispositivo</p>
                    <p className="text-muted-foreground truncate text-[10px]" title={log.user_agent}>
                      {log.user_agent?.split('(')[0] || 'Desconhecido'}
                    </p>
                  </div>
                </div>

                {(log.old_data || log.new_data) && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                      <Search className="h-3 w-3" />
                      Dados Alterados
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {(!filteredLogs || filteredLogs.length === 0) && (
          <div className="py-20 text-center bento-card border-dashed">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Nenhum log encontrado</h3>
            <p className="text-sm text-muted-foreground">Não foram encontrados registros de auditoria com os filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
