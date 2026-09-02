'use client'

import { useEffect, useState } from 'react'
import { Printer, ChevronLeft, Calendar, Building2, User, FileText, Activity, Users } from 'lucide-react'
import { formatCurrency, formatDateBR } from '@/utils/format'
import { groupBillingData } from '@/utils/reportGrouping'

interface PrintReportClientProps {
  data: any[]
  type: string
  startDate: string
  endDate: string
  clinicName?: string
  professionalName?: string
  patientName?: string
  procedureName?: string
  mode: string
}

export default function PrintReportClient({
  data,
  type,
  startDate,
  endDate,
  clinicName,
  professionalName,
  patientName,
  procedureName,
  mode
}: PrintReportClientProps) {
  
  const [authId, setAuthId] = useState('')

  useEffect(() => {
    // Generate authenticity ID on mount (client-side only) to prevent SSR hydration mismatch
    setAuthId(Math.random().toString(36).substring(2, 15).toUpperCase())

    // Wait for content to render and trigger print
    const timer = setTimeout(() => {
      window.print()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const getReportTitle = () => {
    switch (type) {
      case 'grouped_billing': return 'Relatório de Produção por Profissional e Paciente'
      case 'billing': return 'Relatório de Faturamento'
      case 'conference': return 'Relatório de Conferência'
      case 'performance': return 'Relatório de Produtividade e Desempenho'
      case 'consistency': return 'Relatório de Auditoria e Consistência'
      default: return 'Relatório SisTEA'
    }
  }

  const totals = {
    billing: data.reduce((acc, row) => acc + (Number(row.value) || 0), 0),
    susTotal: data.reduce((acc, row) => acc + (Number(row.valor_sus) || 0), 0),
    rpTotal: data.reduce((acc, row) => acc + (Number(row.valor_rp) || 0), 0),
    completed: data.reduce((acc, row) => acc + (row.completed_sessions || 0), 0),
    missed: data.reduce((acc, row) => acc + (row.missed_sessions || 0), 0),
    pending: data.reduce((acc, row) => acc + (row.pending_sessions || 0), 0),
    performanceValue: data.reduce((acc, row) => acc + (Number(row.total_value) || 0), 0),
    inconsistencies: data.length
  }

  return (
    <div className="bg-white p-8 print:p-0 text-slate-900 font-sans w-full max-w-full print:max-w-none">
      {/* Controls - Hidden in Print */}
      <div className="flex items-center justify-between mb-8 no-print bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <button 
          onClick={() => window.close()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Fechar Aba
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Novamente
          </button>
        </div>
      </div>

      {/* Header - Forced Block in Print */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4 print:pb-2 print:mb-2.5 print:flex">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 mb-1 print:mb-0.5">
            <div className="h-9 w-9 print:h-5 print:w-5 bg-slate-900 rounded-lg flex items-center justify-center print:border print:border-slate-900">
              <Activity className="text-white print:text-slate-900 h-5 w-5 print:h-3 print:w-3" />
            </div>
            <div>
              <h1 className="text-xl print:text-xs font-black uppercase tracking-tighter text-slate-900">SisTEA</h1>
              <p className="text-[9px] print:text-[5pt] font-black text-slate-500 uppercase tracking-[0.25em] -mt-1 print:-mt-0.5">Inteligência Terapêutica</p>
            </div>
          </div>
          <h2 className="text-lg print:text-[9pt] font-black text-slate-800 uppercase leading-none">{getReportTitle()}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 print:mt-0.5 text-xs print:text-[6.5pt] font-bold text-slate-600">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 print:h-2 print:w-2" />
              Período: {new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </div>
            {clinicName && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 print:h-2 print:w-2" />
                Unidade: {clinicName}
              </div>
            )}
            <div className="flex items-center gap-1 capitalize">
              <FileText className="h-3.5 w-3.5 print:h-2 print:w-2" />
              Modo: {mode === 'official' ? 'Oficial (Fechado)' : mode === 'preview' ? 'Prévia (Aberto)' : 'Todos os Dados'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] print:text-[5.5pt] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gerado em</p>
          <p className="text-xs print:text-[6.5pt] font-bold text-slate-800">{new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Secondary Filters */}
      {(professionalName || patientName || procedureName) && (
        <div className="grid grid-cols-3 gap-3 mb-4 print:mb-2 bg-slate-50 p-3 print:p-1 rounded-lg border border-slate-200 border-l-4 border-l-primary/30">
          {professionalName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] print:text-[5pt] font-black text-slate-400 uppercase tracking-widest">Profissional</span>
              <span className="text-xs print:text-[6.5pt] font-bold text-slate-800 truncate">{professionalName}</span>
            </div>
          )}
          {patientName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] print:text-[5pt] font-black text-slate-400 uppercase tracking-widest">Paciente</span>
              <span className="text-xs print:text-[6.5pt] font-bold text-slate-800 truncate">{patientName}</span>
            </div>
          )}
          {procedureName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] print:text-[5pt] font-black text-slate-400 uppercase tracking-widest">Procedimento</span>
              <span className="text-xs print:text-[6.5pt] font-bold text-slate-800 truncate">{procedureName}</span>
            </div>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="w-full">
        {type === 'grouped_billing' ? (
          (() => {
            const grouped = groupBillingData(data)
            return (
              <div className="space-y-6 print:space-y-3">
                {grouped.professionals.map((prof) => (
                  <div key={prof.key} className="prof-block border border-slate-300 rounded-xl overflow-visible print:rounded-lg print:border-slate-400 bg-white">
                    {/* Professional Header */}
                    <div className="bg-slate-900 text-white px-3 py-2 print:px-2 print:py-1 flex justify-between items-center text-xs print:text-[6.5pt] font-black rounded-t-xl print:rounded-t-lg">
                      <div className="flex items-center gap-3">
                        <span className="uppercase tracking-tight font-black">👨‍⚕️ PROFISSIONAL: {prof.professional_name}</span>
                        <span className="text-slate-300 font-mono text-[10px] print:text-[5.5pt] font-normal">CNS: {prof.professional_cns}</span>
                        <span className="text-slate-300 font-mono text-[10px] print:text-[5.5pt] font-normal">CBO: {prof.professional_cbo}</span>
                      </div>
                      <div className="text-[10px] print:text-[5.5pt] text-slate-300 uppercase tracking-widest">
                        {prof.total_patients} {prof.total_patients === 1 ? 'Paciente' : 'Pacientes'} | {prof.total_sessions} {prof.total_sessions === 1 ? 'Sessão' : 'Sessões'}
                      </div>
                    </div>

                    {/* Patients List */}
                    <div className="p-3 print:p-1.5 space-y-4 print:space-y-2 bg-slate-50/60 rounded-b-xl print:rounded-b-lg">
                      {prof.patients.map((pat) => (
                        <div key={pat.key} className="pat-block bg-white border border-slate-300 rounded-lg overflow-visible print:rounded-md shadow-2xs print:shadow-none">
                          {/* Patient Header */}
                          <div className="bg-slate-100 border-b border-slate-300 px-2.5 py-1.5 print:px-1.5 print:py-0.5 text-xs print:text-[6pt] font-bold text-slate-800 flex justify-between items-center rounded-t-lg print:rounded-t-md">
                            <div className="flex items-center gap-3">
                              <span>👤 PACIENTE: <strong className="text-slate-900 font-black">{pat.patient_name}</strong></span>
                              <span className="text-slate-600 font-mono text-[10px] print:text-[5pt]">CNS: {pat.patient_cns}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 text-[10px] print:text-[5pt]">AUTORIZAÇÃO (APAC): <strong className="text-slate-900 font-mono font-black">{pat.auth_number}</strong></span>
                            </div>
                          </div>

                          {/* Sessions Table */}
                          <table className="w-full table-fixed border-collapse">
                            <colgroup>
                              <col className="w-[10%]" />
                              <col className="w-[45%]" />
                              <col className="w-[13%]" />
                              <col className="w-[10%]" />
                              <col className="w-[11%]" />
                              <col className="w-[11%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-50 text-[9px] print:text-[5.5pt] text-slate-600 font-black uppercase border-b border-slate-200">
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-center">Data</th>
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-left">Procedimento</th>
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-center">Status</th>
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-right">SUS (Fed.)</th>
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-right">RP (Mun.)</th>
                                <th className="py-1 px-1.5 print:py-0.5 print:px-1 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pat.sessions.map((s, sIdx) => (
                                <tr key={sIdx} className="border-b border-slate-100 text-xs print:text-[6pt]">
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-center font-medium text-slate-700 whitespace-nowrap">
                                    {formatDateBR(s.session_date)}
                                  </td>
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-left italic break-words leading-tight">
                                    <span className="font-bold not-italic">{s.procedure_code || 'SEM CÓDIGO'}</span> - {s.procedure_name}
                                  </td>
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black uppercase tracking-tighter text-[9px] print:text-[5pt]">
                                    {s.status}
                                  </td>
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right whitespace-nowrap">
                                    {formatCurrency(s.valor_sus || 0)}
                                  </td>
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right whitespace-nowrap">
                                    {formatCurrency(s.valor_rp || 0)}
                                  </td>
                                  <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right font-bold text-slate-900 whitespace-nowrap">
                                    {formatCurrency(s.value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100/90 font-bold text-xs print:text-[6pt] border-t border-slate-300">
                                <td colSpan={3} className="py-1 px-1.5 print:py-0.5 print:px-1 text-right uppercase tracking-tighter text-slate-700">
                                  🔹 Subtotal do Paciente ({pat.total_sessions} {pat.total_sessions === 1 ? 'Sessão' : 'Sessões'}):
                                </td>
                                <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right whitespace-nowrap">{formatCurrency(pat.total_sus)}</td>
                                <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right whitespace-nowrap">{formatCurrency(pat.total_rp)}</td>
                                <td className="py-1 px-1.5 print:py-0.5 print:px-1 text-right font-black text-slate-900 whitespace-nowrap">{formatCurrency(pat.total_value)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ))}

                      {/* Subtotal of Professional */}
                      <div className="prof-subtotal bg-slate-200/90 border-t-2 border-slate-400 p-2 print:p-1 rounded-lg flex justify-between items-center text-xs print:text-[6.5pt] font-black text-slate-900">
                        <span>🏅 SUBTOTAL PROFISSIONAL - {prof.professional_name} ({prof.total_patients} {prof.total_patients === 1 ? 'Paciente' : 'Pacientes'} | {prof.total_sessions} {prof.total_sessions === 1 ? 'Sessão' : 'Sessões'})</span>
                        <div className="flex gap-4 print:gap-3">
                          <span>SUS: {formatCurrency(prof.total_sus)}</span>
                          <span>RP: {formatCurrency(prof.total_rp)}</span>
                          <span className="text-slate-900 font-black">TOTAL: {formatCurrency(prof.total_value)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Grand Total Footer */}
                <div className="grand-total bg-slate-900 text-white p-3 print:p-2 rounded-xl mt-4 print:mt-2 text-xs print:text-[7pt] font-bold">
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-tight font-black">
                      🏛️ TOTAL GERAL CONSOLIDADO DA COMPETÊNCIA ({grouped.overall.total_professionals} {grouped.overall.total_professionals === 1 ? 'Profissional' : 'Profissionais'} | {grouped.overall.total_patients} Pacientes | {grouped.overall.total_sessions} Sessões)
                    </span>
                    <div className="flex gap-4 print:gap-3 font-mono font-black text-xs print:text-[7.5pt]">
                      <span className="text-slate-300">SUS: {formatCurrency(grouped.overall.total_sus)}</span>
                      <span className="text-slate-300">RP: {formatCurrency(grouped.overall.total_rp)}</span>
                      <span className="text-white font-black underline">TOTAL: {formatCurrency(grouped.overall.total_value)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        ) : type === 'performance' ? (
          <table className="w-full table-fixed border-collapse border border-slate-300">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 print:bg-slate-100">
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Profissional / Clínica</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Realizados</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Faltas</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Glosadas</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Pendentes</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Taxa de Glosa</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const totalSessions = (row.completed_sessions || 0) + (row.missed_sessions || 0) + (row.pending_sessions || 0) + (row.denied_sessions || 0)
                const deniedRate = totalSessions > 0 ? ((row.denied_sessions || 0) / totalSessions * 100).toFixed(1) : '0'
                
                return (
                  <tr key={i} className="hover:bg-slate-50 print:hover:bg-transparent">
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] font-bold break-words">
                      {row.professional_name}<br/>
                      <span className="text-[9px] print:text-[5pt] font-normal text-slate-500 uppercase">{row.clinic_name}</span>
                    </td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center">{row.completed_sessions || 0}</td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center">{row.missed_sessions || 0}</td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center">{row.denied_sessions || 0}</td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center">{row.pending_sessions || 0}</td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center font-bold">{deniedRate}%</td>
                    <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-right font-bold whitespace-nowrap">{formatCurrency(row.total_value)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-50 print:bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] uppercase tracking-tighter">Totais Consolidados</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-center">{totals.completed}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-center">{totals.missed}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-center">{data.reduce((acc, row) => acc + (row.denied_sessions || 0), 0)}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-center">{totals.pending}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-center">-</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right text-slate-900 font-black whitespace-nowrap">{formatCurrency(totals.performanceValue)}</td>
              </tr>
            </tfoot>
          </table>
        ) : type === 'consistency' ? (
          <table className="w-full table-fixed border-collapse border border-slate-300">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[30%]" />
              <col className="w-[40%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 print:bg-slate-100">
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Paciente / Data</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Profissional</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Inconsistência Identificada</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] break-words">
                    <span className="font-bold">{row.patient_name}</span><br/>
                    <span className="text-[9px] print:text-[5pt] text-slate-500 font-black">{formatDateBR(row.session_date)}</span>
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] font-medium break-words">{row.professional_name}</td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-rose-700 font-bold italic break-words">{row.issue_type}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 print:bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td colSpan={2} className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right uppercase tracking-tighter">Total de Registros Auditados:</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] font-black text-rose-700">{totals.inconsistencies} inconsistências</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full table-fixed border-collapse border border-slate-300">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[17%]" />
              <col className="w-[27%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[7.5%]" />
              <col className="w-[7.5%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 print:bg-slate-100">
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Paciente / CNS</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Profissional / CBO</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-left">Procedimento</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Data</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-center">Status</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-right">SUS (Fed.)</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-right">RP (Mun.)</th>
                <th className="border border-slate-300 p-2 print:py-1 print:px-1 text-[10px] print:text-[6pt] font-black uppercase text-slate-700 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] break-words">
                    <span className="font-bold leading-tight block">{row.patient_name}</span>
                    <span className="text-[9px] print:text-[5pt] text-slate-500 font-mono tracking-tighter block">{row.patient_cns || 'SEM CNS'}</span>
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] break-words">
                    <span className="font-medium text-slate-800 leading-tight block">{row.professional_name}</span>
                    <span className="text-[9px] print:text-[5pt] text-slate-500 font-mono tracking-tighter block">{row.professional_cbo || 'SEM CBO'}</span>
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] italic break-words leading-tight">
                    <span className="font-bold not-italic">{row.procedure_code || 'SEM CÓDIGO'}</span> - {row.procedure_name}
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center whitespace-nowrap">
                    {formatDateBR(row.session_date)}
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-center font-black uppercase tracking-tighter">
                    {row.status}
                  </td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-right whitespace-nowrap">{formatCurrency(row.valor_sus || 0)}</td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-right whitespace-nowrap">{formatCurrency(row.valor_rp || 0)}</td>
                  <td className="border border-slate-300 p-2 print:py-0.5 print:px-1 text-xs print:text-[6pt] text-right font-bold whitespace-nowrap">{formatCurrency(row.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 print:bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td colSpan={5} className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right uppercase tracking-tighter italic">Valor Total Consolidado da Produção:</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right font-bold whitespace-nowrap">{formatCurrency(totals.susTotal)}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right font-bold whitespace-nowrap">{formatCurrency(totals.rpTotal)}</td>
                <td className="border border-slate-300 p-2 print:py-1 print:px-1 text-xs print:text-[6pt] text-right text-slate-900 font-black whitespace-nowrap">{formatCurrency(totals.billing)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Footer / Governance */}
      <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end print:mt-3 print:pt-1.5">
        <div className="text-[10px] print:text-[5pt] font-medium text-slate-500 leading-tight">
          <p>SisTEA - Sistema de Gestão e Inteligência Terapêutica</p>
          <p>Este relatório é um documento oficial gerado para fins de conferência e auditoria.</p>
          <p className="mt-0.5 font-black">ID de Autenticidade: {authId}</p>
        </div>
        <div className="flex flex-col items-center gap-1.5 print:gap-0.5">
          <div className="w-56 print:w-36 border-b border-slate-900"></div>
          <p className="text-[10px] print:text-[5.5pt] font-black uppercase tracking-widest text-slate-900">Assinatura Responsável</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            overflow: visible !important;
            position: static !important;
          }
          @page {
            margin: 0.5cm !important;
            size: A4 portrait;
          }
          div, main, section, article {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          .prof-block {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .pat-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .prof-subtotal, .grand-total {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }
      `}</style>
    </div>
  )
}
