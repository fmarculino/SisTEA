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
  searchParams: { q?: string; clinic?: string }
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
      paramName: 'clinic',
      placeholder: 'Todas Clínicas',
      options: clinics?.map((c: any) => ({ value: c.id, label: c.name })) || [],
    },
  ]

  // Main query for audit logs
  let query = supabase
    .from('attendance_sessions')
    .select(`
      id,
      validated_at,
      validation_ip,
      validation_ua,
      validation_geo,
      validation_distance,
      is_out_of_range,
      session_date,
      start_time,
      attendance:attendances(
        patient:patients(name),
        professional:professionals(name),
        clinic:clinics(name)
      )
    `)
    .not('validated_at', 'is', null)
    .order('validated_at', { ascending: false })

  if (queryParams.clinic && queryParams.clinic !== 'all') {
    query = query.filter('attendance.clinic_id', 'eq', queryParams.clinic)
  }

  const { data: logs } = await query.limit(100)

  // Client-side search (fallback for complex joins if needed)
  const filteredLogs = queryParams.q 
    ? logs?.filter((log: any) => 
        log.attendance?.patient?.name.toLowerCase().includes(queryParams.q!.toLowerCase()) ||
        log.attendance?.professional?.name.toLowerCase().includes(queryParams.q!.toLowerCase())
      )
    : logs

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            Auditoria de Validações
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitore em tempo real as assinaturas digitais realizadas pelos responsáveis.
          </p>
        </div>
        <ExportAuditButton data={filteredLogs || []} />
      </div>

      <DataTableFilters 
        placeholder="Pesquisar por paciente ou profissional..." 
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
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                      ASSINATURA DIGITAL
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ID: {log.id.split('-')[0]}...
                    </span>
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {format(new Date(log.validated_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Paciente</p>
                    <p className="font-bold text-foreground">{log.attendance?.patient?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Profissional</p>
                    <p className="font-medium text-foreground/80">{log.attendance?.professional?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Clínica</p>
                    <p className="text-sm text-muted-foreground">{log.attendance?.clinic?.name}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex flex-wrap gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Sessão: {format(new Date(log.session_date + 'T00:00:00'), 'dd/MM/yyyy')} às {log.start_time}
                  </span>
                </div>
              </div>

              {/* Audit Metadata */}
              <div className="lg:w-72 bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <Globe className="h-4 w-4 text-sky-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-bold text-foreground">Endereço IP</p>
                    <p className="text-muted-foreground font-mono truncate">{log.validation_ip}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Tablet className="h-4 w-4 text-purple-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-bold text-foreground">Dispositivo</p>
                    <p className="text-muted-foreground truncate" title={log.validation_ua}>
                      {log.validation_ua?.split('(')[0] || 'Desconhecido'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <MapPin className={`h-4 w-4 shrink-0 ${log.validation_geo ? 'text-rose-500' : 'text-muted-foreground/40'}`} />
                  <div>
                    <p className="font-bold text-foreground">Geolocalização</p>
                    {log.validation_geo ? (
                      <div className="space-y-1">
                        <p className="text-rose-500 font-bold">
                          {log.validation_geo.lat.toFixed(4)}, {log.validation_geo.lng.toFixed(4)}
                        </p>
                        {log.validation_distance !== null && (
                          <p className={`text-[10px] font-bold ${log.is_out_of_range ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20' : 'text-muted-foreground'}`}>
                            {log.validation_distance < 1000 
                              ? `${Math.round(log.validation_distance)}m da clínica` 
                              : `${(log.validation_distance / 1000).toFixed(1)}km da clínica`}
                            {log.is_out_of_range && ' ⚠️ REMOTA'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">Não capturada</p>
                    )}
                  </div>
                </div>
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
            <p className="text-sm text-muted-foreground">Não há validações digitais registradas com os filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
