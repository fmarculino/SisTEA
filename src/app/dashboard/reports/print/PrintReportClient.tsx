'use client'

import { useEffect } from 'react'
import { Printer, ChevronLeft, Calendar, Building2, User, FileText, Activity } from 'lucide-react'
import { formatCurrency } from '@/utils/format'

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
  
  useEffect(() => {
    // Wait for content to render and trigger print
    const timer = setTimeout(() => {
      window.print()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const getReportTitle = () => {
    switch (type) {
      case 'billing': return 'Relatório de Faturamento'
      case 'conference': return 'Relatório de Conferência'
      case 'performance': return 'Relatório de Produtividade e Desempenho'
      case 'consistency': return 'Relatório de Auditoria e Consistência'
      default: return 'Relatório SisTEA'
    }
  }

  const totals = {
    billing: data.reduce((acc, row) => acc + (Number(row.value) || 0), 0),
    completed: data.reduce((acc, row) => acc + (row.completed_sessions || 0), 0),
    missed: data.reduce((acc, row) => acc + (row.missed_sessions || 0), 0),
    pending: data.reduce((acc, row) => acc + (row.pending_sessions || 0), 0),
    performanceValue: data.reduce((acc, row) => acc + (Number(row.total_value) || 0), 0),
    inconsistencies: data.length
  }

  return (
    <div className="bg-white p-8 text-slate-900 font-sans">
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
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 print:flex">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center print:border-2 print:border-slate-900">
              <Activity className="text-white print:text-slate-900 h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">SisTEA</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] -mt-1.5">Inteligência Terapêutica</p>
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase">{getReportTitle()}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Período: {new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </div>
            {clinicName && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Unidade: {clinicName}
              </div>
            )}
            <div className="flex items-center gap-1.5 capitalize">
              <FileText className="h-3.5 w-3.5" />
              Modo: {mode === 'official' ? 'Oficial (Fechado)' : mode === 'preview' ? 'Prévia (Aberto)' : 'Todos os Dados'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gerado em</p>
          <p className="text-xs font-bold text-slate-800">{new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Secondary Filters */}
      {(professionalName || patientName || procedureName) && (
        <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100 border-l-4 border-l-primary/30">
          {professionalName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Profissional</span>
              <span className="text-xs font-bold text-slate-800">{professionalName}</span>
            </div>
          )}
          {patientName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Paciente</span>
              <span className="text-xs font-bold text-slate-800">{patientName}</span>
            </div>
          )}
          {procedureName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedimento</span>
              <span className="text-xs font-bold text-slate-800">{procedureName}</span>
            </div>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="w-full">
        {type === 'performance' ? (
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Profissional / Clínica</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Realizados</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Não Realizado</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Glosadas</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Pendentes</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Taxa de Glosa</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const totalSessions = (row.completed_sessions || 0) + (row.missed_sessions || 0) + (row.pending_sessions || 0) + (row.denied_sessions || 0)
                const deniedRate = totalSessions > 0 ? ((row.denied_sessions || 0) / totalSessions * 100).toFixed(1) : '0'
                
                return (
                  <tr key={i}>
                    <td className="border border-slate-200 p-3 text-xs font-bold">
                      {row.professional_name}<br/>
                      <span className="text-[9px] font-normal text-slate-500 uppercase">{row.clinic_name}</span>
                    </td>
                    <td className="border border-slate-200 p-3 text-xs text-center">{row.completed_sessions || 0}</td>
                    <td className="border border-slate-200 p-3 text-xs text-center">{row.missed_sessions || 0}</td>
                    <td className="border border-slate-200 p-3 text-xs text-center">{row.denied_sessions || 0}</td>
                    <td className="border border-slate-200 p-3 text-xs text-center">{row.pending_sessions || 0}</td>
                    <td className="border border-slate-200 p-3 text-xs text-center font-bold">{deniedRate}%</td>
                    <td className="border border-slate-200 p-3 text-xs text-right font-bold">{formatCurrency(row.total_value)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td className="border border-slate-200 p-3 text-xs uppercase tracking-tighter">Totais Consolidados</td>
                <td className="border border-slate-200 p-3 text-xs text-center">{totals.completed}</td>
                <td className="border border-slate-200 p-3 text-xs text-center">{totals.missed}</td>
                <td className="border border-slate-200 p-3 text-xs text-center">{data.reduce((acc, row) => acc + (row.denied_sessions || 0), 0)}</td>
                <td className="border border-slate-200 p-3 text-xs text-center">{totals.pending}</td>
                <td className="border border-slate-200 p-3 text-xs text-center">-</td>
                <td className="border border-slate-200 p-3 text-xs text-right text-primary font-black">{formatCurrency(totals.performanceValue)}</td>
              </tr>
            </tfoot>
          </table>
        ) : type === 'consistency' ? (
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Paciente / Data</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Profissional</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Inconsistência Identificada</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 p-3 text-xs">
                    <span className="font-bold">{row.patient_name}</span><br/>
                    <span className="text-[9px] text-slate-500 font-black">{new Date(row.session_date).toLocaleDateString('pt-BR')}</span>
                  </td>
                  <td className="border border-slate-200 p-3 text-xs font-medium">{row.professional_name}</td>
                  <td className="border border-slate-200 p-3 text-xs text-rose-600 font-bold italic">{row.issue_type}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td colSpan={2} className="border border-slate-200 p-3 text-xs text-right uppercase tracking-tighter">Total de Registros Auditados:</td>
                <td className="border border-slate-200 p-3 text-xs font-black text-rose-600">{totals.inconsistencies} inconsistências</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Paciente / CNS</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Profissional / CBO</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-left">Procedimento</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Data</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-center">Status</th>
                <th className="border border-slate-200 p-3 text-[10px] font-black uppercase text-slate-600 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 p-3 text-xs">
                    <span className="font-bold">{row.patient_name}</span><br/>
                    <span className="text-[9px] text-slate-500 font-mono tracking-tighter">{row.patient_cns || 'SEM CNS'}</span>
                  </td>
                  <td className="border border-slate-200 p-3 text-xs">
                    <span className="font-medium text-slate-800">{row.professional_name}</span><br/>
                    <span className="text-[9px] text-slate-500 font-mono tracking-tighter">{row.professional_cbo || 'SEM CBO'}</span>
                  </td>
                  <td className="border border-slate-200 p-3 text-xs italic">
                    <span className="font-bold">{row.procedure_code}</span> - {row.procedure_name}
                  </td>
                  <td className="border border-slate-200 p-3 text-xs text-center whitespace-nowrap">
                    {new Date(row.session_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="border border-slate-200 p-3 text-xs text-center font-black uppercase tracking-tighter">
                    {row.status}
                  </td>
                  <td className="border border-slate-200 p-3 text-xs text-right font-bold">{formatCurrency(row.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-bold border-t-2 border-slate-900">
                <td colSpan={5} className="border border-slate-200 p-3 text-xs text-right uppercase tracking-tighter italic">Valor Total Consolidado da Produção:</td>
                <td className="border border-slate-200 p-3 text-xs text-right text-primary font-black">{formatCurrency(totals.billing)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Footer / Governance */}
      <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-end">
        <div className="text-[10px] font-medium text-slate-500">
          <p>SisTEA - Sistema de Gestão e Inteligência Terapêutica</p>
          <p>Este relatório é um documento oficial gerado para fins de conferência e auditoria.</p>
          <p className="mt-1 font-black">ID de Autenticidade: {Math.random().toString(36).substring(2, 15).toUpperCase()}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-64 border-b border-slate-900"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Assinatura Responsável</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 1.5cm;
            size: landscape;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
    </div>
  )
}
