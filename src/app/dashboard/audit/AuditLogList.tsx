'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { 
  X, Globe, ShieldCheck, 
  ArrowRight, Info, Database, History,
  Eye, Monitor, User
} from 'lucide-react'

interface AuditLogListProps {
  logs: any[]
}

export function AuditLogList({ logs }: AuditLogListProps) {
  const [selectedLog, setSelectedLog] = useState<any>(null)

  return (
    <>
      <div className="divide-y divide-border/10">
        {logs.map((log) => (
          <button
            key={log.id}
            onClick={() => setSelectedLog(log)}
            className="w-full text-left transition-all hover:bg-muted/30 group px-6 py-2.5 flex items-center gap-4"
          >
            {/* 1. Action Icon (Fixed Width) */}
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
              log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
              log.action === 'DELETE' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
              log.action === 'UPDATE' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
              'bg-sky-500/10 text-sky-500 border-sky-500/20'
            }`}>
              {log.action === 'CREATE' ? <Database className="h-3.5 w-3.5" /> :
               log.action === 'DELETE' ? <X className="h-3.5 w-3.5" /> :
               log.action === 'UPDATE' ? <History className="h-3.5 w-3.5" /> :
               <Monitor className="h-3.5 w-3.5" />}
            </div>

            {/* 2. Date & Resource (Fixed Width) */}
            <div className="w-32 shrink-0">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                {format(new Date(log.created_at), "dd/MM/yyyy")}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-primary uppercase tracking-tighter truncate">
                  {log.table_name || 'SISTEMA'}
                </span>
              </div>
            </div>

            {/* 3. Description (Flexible) */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                {log.description}
              </p>
              <p className="text-[9px] text-muted-foreground opacity-60 font-mono">
                {format(new Date(log.created_at), "HH:mm:ss")}
              </p>
            </div>

            {/* 4. User Info (Fixed Width - Aligned) */}
            <div className="hidden md:flex items-center gap-3 shrink-0 w-64 px-4 border-l border-border/10">
              <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-foreground truncate">{log.user_email}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-50">
                    {log.user_role === 'SMS_ADMIN' ? 'Controlador' : 'Gestor'}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Metadata (Fixed Width) */}
            <div className="hidden lg:flex items-center gap-3 shrink-0 w-44 px-4 border-l border-border/10">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20 border border-border/5 border-dashed">
                <Globe className="h-2.5 w-2.5 text-sky-500" />
                <span className="text-[9px] font-mono text-muted-foreground">{log.ip_address}</span>
              </div>
              {log.old_data || log.new_data ? (
                <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                  <Database className="h-3 w-3 text-emerald-500" />
                </div>
              ) : (
                <div className="w-6" /> // Spacer
              )}
            </div>

            {/* 6. Action Arrow */}
            <div className="shrink-0 w-6 flex justify-end">
              <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
            </div>
          </button>
        ))}

        {(!logs || logs.length === 0) && (
          <div className="py-20 text-center">
            <h3 className="text-lg font-bold text-foreground">Nenhum log encontrado</h3>
            <p className="text-sm text-muted-foreground">Não foram encontrados registros de auditoria.</p>
          </div>
        )}
      </div>

      {/* Detail Modal (Keep same as before but ensure good styling) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border/50 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground tracking-tight">Detalhes da Auditoria</h3>
                  <p className="text-xs text-muted-foreground font-mono">UUID: {selectedLog.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1 bg-muted/30 p-4 rounded-2xl border border-border/40">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Ação Realizada</p>
                  <p className="text-sm font-bold text-foreground">{selectedLog.action}</p>
                </div>
                <div className="space-y-1 bg-muted/30 p-4 rounded-2xl border border-border/40">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recurso/Tabela</p>
                  <p className="text-sm font-bold text-foreground uppercase">{selectedLog.table_name || 'N/A'}</p>
                </div>
                <div className="space-y-1 bg-muted/30 p-4 rounded-2xl border border-border/40">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Data e Hora</p>
                  <p className="text-sm font-bold text-foreground">{format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                  <Info className="h-4 w-4 text-primary" />
                  Descrição do Evento
                </div>
                <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl">
                  <p className="text-lg font-bold text-foreground leading-relaxed">
                    {selectedLog.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    <Monitor className="h-4 w-4 text-purple-500" />
                    Origem da Conexão
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                      <span className="text-xs text-muted-foreground font-medium">Endereço IP</span>
                      <span className="text-xs font-mono font-bold text-foreground">{selectedLog.ip_address}</span>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-xl space-y-2">
                      <span className="text-xs text-muted-foreground font-medium">User Agent (Dispositivo)</span>
                      <p className="text-[10px] font-mono text-foreground break-all leading-relaxed">
                        {selectedLog.user_agent}
                      </p>
                    </div>


                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    <User className="h-4 w-4 text-sky-500" />
                    Responsável
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                      <span className="text-xs text-muted-foreground font-medium">E-mail</span>
                      <span className="text-xs font-bold text-foreground">{selectedLog.user_email || 'Paciente (Assinatura Digital)'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                      <span className="text-xs text-muted-foreground font-medium">Nível de Acesso</span>
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary uppercase">
                        {selectedLog.user_role || 'EXTERNO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedLog.new_data?.validation_geo && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    Geolocalização da Assinatura
                  </div>
                  <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                       <p className="text-sm font-bold text-foreground">
                         📍 Coordenadas: {selectedLog.new_data.validation_geo.lat.toFixed(6)}, {selectedLog.new_data.validation_geo.lng.toFixed(6)}
                       </p>
                       <p className="text-[10px] text-muted-foreground italic">
                         Localização capturada via GPS no momento da assinatura digital do paciente.
                       </p>
                    </div>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedLog.new_data.validation_geo.lat},${selectedLog.new_data.validation_geo.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      🗺️ Ver no Google Maps
                    </a>
                  </div>
                </div>
              )}

              {(selectedLog.old_data || selectedLog.new_data) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    <History className="h-4 w-4 text-emerald-500" />
                    Comparação de Dados
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Dados Anteriores</p>
                      <div className="p-4 bg-muted/20 rounded-2xl border border-border/40 font-mono text-[10px] min-h-[100px] overflow-auto max-h-[300px] no-scrollbar">
                        {selectedLog.old_data ? (
                          <pre className="text-rose-400">
                            {JSON.stringify(selectedLog.old_data, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-muted-foreground italic text-center py-8">Nenhum dado anterior (Novo registro)</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 relative">
                      {selectedLog.old_data && (
                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
                          <div className="h-6 w-6 rounded-full bg-background border border-border/50 flex items-center justify-center shadow-sm">
                            <ArrowRight className="h-3 w-3 text-emerald-500" />
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Novos Dados / Estado Final</p>
                      <div className="p-4 bg-muted/20 rounded-2xl border border-border/40 font-mono text-[10px] min-h-[100px] overflow-auto max-h-[300px] no-scrollbar">
                        {selectedLog.new_data ? (
                          <pre className="text-emerald-400">
                            {JSON.stringify(selectedLog.new_data, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-muted-foreground italic text-center py-8">Nenhum dado novo (Exclusão)</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border/50 bg-muted/10 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
