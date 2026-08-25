'use client'

import React, { useState } from 'react'
import { 
  FileDown, 
  FileText, 
  BarChart3, 
  ShieldAlert, 
  Search, 
  Building2, 
  Users, 
  User, 
  Calendar, 
  Filter, 
  Download, 
  Settings2,
  ChevronDown,
  Layers
} from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { Pagination } from '@/components/ui/Pagination'
import * as XLSX from 'xlsx'
import { createReportRequest } from './actions'
import { groupBillingData } from '@/utils/reportGrouping'

interface ReportsClientProps {
  initialData: any[]
  totalCount: number
  currentPage: number
  itemsPerPage: number
  type: 'conference' | 'billing' | 'grouped_billing' | 'performance' | 'consistency'
  filters: {
    clinics: any[]
    professionals: any[]
    patients: any[]
    procedures: any[]
    competences: any[]
  }
  selectedCompetenceId: string
  startDate: string
  endDate: string
  selectedClinic: string
  selectedProfessional: string
  selectedPatient: string
  selectedProcedure: string
  mode: 'official' | 'preview' | 'all'
  userRole: string
}

export default function ReportsClient({
  initialData,
  totalCount,
  currentPage,
  itemsPerPage,
  type,
  filters,
  selectedCompetenceId,
  startDate,
  endDate,
  selectedClinic,
  selectedProfessional,
  selectedPatient,
  selectedProcedure,
  mode,
  userRole
}: ReportsClientProps) {
  const [isCustomPeriod, setIsCustomPeriod] = useState(startDate !== '' && !selectedCompetenceId)
  const [localStartDate, setLocalStartDate] = useState(startDate)
  const [localEndDate, setLocalEndDate] = useState(endDate)

  // Function to calculate dates based on competence
  const handleCompetenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const compId = e.target.value
    if (!compId) return

    const comp = filters.competences.find(c => c.id === compId)
    if (comp) {
      // In a real scenario, we'd use the closing_day logic or explicit dates if they existed.
      // For now, we'll let the server handle the calculation if a competence is selected,
      // but we show the estimated range in the UI if possible.
      setIsCustomPeriod(false)
    }
  }
  const [loading, setLoading] = useState(false)

  const handleExport = () => {
    if (!initialData || initialData.length === 0) return

    let exportData: any[] = []

    if (type === 'grouped_billing') {
      const grouped = groupBillingData(initialData)
      grouped.professionals.forEach(prof => {
        prof.patients.forEach(pat => {
          pat.sessions.forEach(s => {
            exportData.push({
              'Profissional': prof.professional_name,
              'CNS Profissional': prof.professional_cns,
              'CBO': prof.professional_cbo,
              'Paciente': pat.patient_name,
              'CNS Paciente': pat.patient_cns,
              'Nº Autorização (APAC)': pat.auth_number,
              'Data Sessão': new Date(s.session_date).toLocaleDateString('pt-BR'),
              'Código Procedimento': s.procedure_code || '',
              'Procedimento': s.procedure_name || '',
              'Status': s.status,
              'SUS (Fed.) R$': s.valor_sus,
              'RP (Mun.) R$': s.valor_rp,
              'Total R$': s.value,
            })
          })
          // Linha de Subtotal do Paciente
          exportData.push({
            'Profissional': '',
            'CNS Profissional': '',
            'CBO': '',
            'Paciente': `SUBTOTAL - ${pat.patient_name} (${pat.total_sessions} sessões)`,
            'CNS Paciente': '',
            'Nº Autorização (APAC)': '',
            'Data Sessão': '',
            'Código Procedimento': '',
            'Procedimento': '',
            'Status': '',
            'SUS (Fed.) R$': pat.total_sus,
            'RP (Mun.) R$': pat.total_rp,
            'Total R$': pat.total_value,
          })
        })
        // Linha de Subtotal do Profissional
        exportData.push({
          'Profissional': `SUBTOTAL - ${prof.professional_name} (${prof.total_patients} pacientes / ${prof.total_sessions} sessões)`,
          'CNS Profissional': '',
          'CBO': '',
          'Paciente': '',
          'CNS Paciente': '',
          'Nº Autorização (APAC)': '',
          'Data Sessão': '',
          'Código Procedimento': '',
          'Procedimento': '',
          'Status': '',
          'SUS (Fed.) R$': prof.total_sus,
          'RP (Mun.) R$': prof.total_rp,
          'Total R$': prof.total_value,
        })
      })
      // Linha de Total Geral
      exportData.push({
        'Profissional': `TOTAL GERAL DA COMPETÊNCIA (${grouped.overall.total_professionals} profissionais / ${grouped.overall.total_sessions} sessões)`,
        'CNS Profissional': '',
        'CBO': '',
        'Paciente': '',
        'CNS Paciente': '',
        'Nº Autorização (APAC)': '',
        'Data Sessão': '',
        'Código Procedimento': '',
        'Procedimento': '',
        'Status': '',
        'SUS (Fed.) R$': grouped.overall.total_sus,
        'RP (Mun.) R$': grouped.overall.total_rp,
        'Total R$': grouped.overall.total_value,
      })
    } else if (type === 'billing' || type === 'conference') {
      exportData = initialData.map(r => ({
        'Clínica': r.clinic_name,
        'Paciente': r.patient_name,
        'CNS Paciente': r.patient_cns,
        'Nº Autorização': r.auth_number || '',
        'Profissional': r.professional_name,
        'CNS Profissional': r.professional_cns,
        'CBO': r.professional_cbo,
        'Código Procedimento': r.procedure_code,
        'Procedimento': r.procedure_name,
        'Data Sessão': new Date(r.session_date).toLocaleDateString('pt-BR'),
        'Status': r.status,
        'SUS (Fed.) R$': Number(r.valor_sus) || 0,
        'RP (Mun.) R$': Number(r.valor_rp) || 0,
        'Total R$': Number(r.value) || 0
      }))
    } else if (type === 'performance') {
      exportData = initialData.map(r => ({
        'Profissional': r.professional_name,
        'Clínica': r.clinic_name,
        'Sessões Realizadas': r.completed_sessions || 0,
        'Faltas': r.missed_sessions || 0,
        'Glosadas': r.denied_sessions || 0,
        'Pendentes': r.pending_sessions || 0,
        'Taxa de Glosa (%)': ((r.denied_sessions || 0) / Math.max(1, (r.completed_sessions || 0) + (r.missed_sessions || 0) + (r.pending_sessions || 0) + (r.denied_sessions || 0)) * 100).toFixed(1),
        'Valor Total R$': Number(r.total_value) || 0
      }))
    } else if (type === 'consistency') {
      exportData = initialData.map(r => ({
        'Paciente': r.patient_name,
        'Data Sessão': new Date(r.session_date).toLocaleDateString('pt-BR'),
        'Profissional': r.professional_name,
        'Inconsistência Identificada': r.issue_type
      }))
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório')
    
    const fileName = `sistea_relatorio_${type}_${startDate}_a_${endDate}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const handlePrint = async () => {
    try {
      setLoading(true)
      const requestId = await createReportRequest({
        type,
        competence_id: selectedCompetenceId,
        start_date: startDate,
        end_date: endDate,
        clinic_id: selectedClinic,
        professional_id: selectedProfessional,
        patient_id: selectedPatient,
        procedure_id: selectedProcedure,
        mode
      })
      
      window.open(`/dashboard/reports/print?request_id=${requestId}`, '_blank')
    } catch (err) {
      console.error(err)
      alert('Falha ao preparar impressão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const renderTable = () => {
    if (!initialData || initialData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 bg-card border border-border/50 rounded-[40px] shadow-sm animate-in fade-in duration-700">
          <div className="h-20 w-20 rounded-[30px] bg-muted flex items-center justify-center mb-6">
            <Search className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Nenhum dado encontrado</h3>
          <p className="text-muted-foreground font-medium mt-2">Ajuste os filtros para visualizar os resultados.</p>
        </div>
      )
    }

    if (type === 'performance') {
      return (
        <div className="bg-card border border-border/50 rounded-[40px] shadow-sm overflow-hidden animate-in fade-in duration-700">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Clínica / Profissional</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Realizados</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Faltas</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Glosadas</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Pendentes</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Taxa de Glosa</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialData.map((row, i) => {
                  const totalSessions = (row.completed_sessions || 0) + (row.missed_sessions || 0) + (row.pending_sessions || 0) + (row.denied_sessions || 0)
                  const deniedRate = totalSessions > 0 ? ((row.denied_sessions || 0) / totalSessions * 100).toFixed(1) : '0'
                  
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors group">
                      <td className="p-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{row.professional_name}</span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{row.clinic_name}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 uppercase">
                          {row.completed_sessions || 0}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-500/10 text-slate-500 uppercase">
                          {row.missed_sessions || 0}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500 uppercase">
                          {row.denied_sessions || 0}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 uppercase">
                          {row.pending_sessions || 0}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`text-xs font-black ${Number(deniedRate) > 20 ? 'text-rose-500' : 'text-foreground'}`}>
                          {deniedRate}%
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <span className="text-sm font-black text-foreground">
                          {formatCurrency(row.total_value)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-muted/30 font-black border-t-2 border-border/50">
                <tr>
                  <td className="p-6 text-[10px] uppercase tracking-widest text-muted-foreground">Totais Consolidados</td>
                  <td className="p-6 text-center text-sm">{initialData.reduce((acc, row) => acc + (row.completed_sessions || 0), 0)}</td>
                  <td className="p-6 text-center text-sm">{initialData.reduce((acc, row) => acc + (row.missed_sessions || 0), 0)}</td>
                  <td className="p-6 text-center text-sm">{initialData.reduce((acc, row) => acc + (row.denied_sessions || 0), 0)}</td>
                  <td className="p-6 text-center text-sm">{initialData.reduce((acc, row) => acc + (row.pending_sessions || 0), 0)}</td>
                  <td className="p-6 text-center text-sm">-</td>
                  <td className="p-6 text-right text-sm text-primary font-black">
                    {formatCurrency(initialData.reduce((acc, row) => acc + (Number(row.total_value) || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-8 border-t border-border/30 bg-muted/20 no-print">
            <Pagination 
              totalItems={totalCount} 
              itemsPerPage={itemsPerPage} 
              currentPage={currentPage} 
            />
          </div>
        </div>
      )
    }

    if (type === 'consistency') {
      return (
        <div className="bg-card border border-border/50 rounded-[40px] shadow-sm overflow-hidden animate-in fade-in duration-700">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Paciente / Data</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Profissional</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inconsistência Identificada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialData.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors group">
                    <td className="p-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-foreground">{row.patient_name}</span>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                          {new Date(row.session_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-sm font-medium text-foreground">{row.professional_name}</td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-500/5 px-3 py-2 rounded-xl border border-rose-500/10 w-fit">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {row.issue_type}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-black border-t-2 border-border/50">
                <tr>
                  <td colSpan={2} className="p-6 text-[10px] uppercase tracking-widest text-muted-foreground text-right">Total de Inconsistências:</td>
                  <td className="p-6 text-rose-500 text-sm font-black">{initialData.length} registros</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-8 border-t border-border/30 bg-muted/20 no-print">
            <Pagination 
              totalItems={totalCount} 
              itemsPerPage={itemsPerPage} 
              currentPage={currentPage} 
            />
          </div>
        </div>
      )
    }

    if (type === 'grouped_billing') {
      const grouped = groupBillingData(initialData)
      return (
        <div className="space-y-8 animate-in fade-in duration-700">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Profissionais</p>
                <p className="text-2xl font-black text-foreground mt-1">{grouped.overall.total_professionals}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pacientes Únicos</p>
                <p className="text-2xl font-black text-foreground mt-1">{grouped.overall.total_patients}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <User className="h-6 w-6" />
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sessões Realizadas</p>
                <p className="text-2xl font-black text-foreground mt-1">{grouped.overall.total_sessions}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Faturamento Total</p>
                <p className="text-2xl font-black text-primary mt-1">{formatCurrency(grouped.overall.total_value)}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Grouped Professionals List */}
          <div className="space-y-6">
            {grouped.professionals.map((prof) => (
              <div key={prof.key} className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm">
                {/* Professional Header Banner */}
                <div className="bg-muted/40 border-b border-border/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-foreground tracking-tight">{prof.professional_name}</h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          CBO: {prof.professional_cbo}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        CNS: {prof.professional_cns} {prof.clinic_name && `• Unidade: ${prof.clinic_name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end md:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produção</span>
                      <p className="text-sm font-bold text-foreground">{prof.total_patients} pacientes | {prof.total_sessions} sessões</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Profissional</span>
                      <p className="text-base font-black text-primary">{formatCurrency(prof.total_value)}</p>
                    </div>
                  </div>
                </div>

                {/* Patients List of this professional */}
                <div className="p-6 space-y-6">
                  {prof.patients.map((pat) => (
                    <div key={pat.key} className="border border-border/40 rounded-2xl overflow-hidden bg-background/50">
                      {/* Patient Info Bar */}
                      <div className="bg-muted/20 px-6 py-3.5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">{pat.patient_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">CNS: {pat.patient_cns}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground">
                            Autorização (APAC): <strong className="text-foreground font-mono font-black">{pat.auth_number}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Sessions Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-border/30 bg-muted/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              <th className="py-3 px-6 text-center w-[120px]">Data</th>
                              <th className="py-3 px-6">Procedimento</th>
                              <th className="py-3 px-6 text-center w-[120px]">Status</th>
                              <th className="py-3 px-6 text-right w-[130px]">SUS (Fed.)</th>
                              <th className="py-3 px-6 text-right w-[130px]">RP (Mun.)</th>
                              <th className="py-3 px-6 text-right w-[140px]">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20 text-xs">
                            {pat.sessions.map((s, sIdx) => (
                              <tr key={sIdx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-6 text-center font-medium text-foreground whitespace-nowrap">
                                  {new Date(s.session_date).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3 px-6">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-foreground">{s.procedure_name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">{s.procedure_code || 'SEM CÓDIGO'}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-6 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                    s.status === 'Realizada' ? 'bg-emerald-500/10 text-emerald-500' :
                                    s.status === 'Pendente' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-rose-500/10 text-rose-500'
                                  }`}>
                                    {s.status}
                                  </span>
                                </td>
                                <td className="py-3 px-6 text-right text-foreground font-medium whitespace-nowrap">
                                  {formatCurrency(s.valor_sus || 0)}
                                </td>
                                <td className="py-3 px-6 text-right text-foreground font-medium whitespace-nowrap">
                                  {formatCurrency(s.valor_rp || 0)}
                                </td>
                                <td className="py-3 px-6 text-right font-black text-foreground whitespace-nowrap">
                                  {formatCurrency(s.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/30 font-black border-t border-border/40 text-xs">
                              <td colSpan={3} className="py-3 px-6 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                                Subtotal Paciente ({pat.total_sessions} {pat.total_sessions === 1 ? 'sessão' : 'sessões'}):
                              </td>
                              <td className="py-3 px-6 text-right text-foreground/80 whitespace-nowrap">{formatCurrency(pat.total_sus)}</td>
                              <td className="py-3 px-6 text-right text-foreground/80 whitespace-nowrap">{formatCurrency(pat.total_rp)}</td>
                              <td className="py-3 px-6 text-right text-primary font-black whitespace-nowrap">{formatCurrency(pat.total_value)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}

                  {/* Professional Subtotal Banner */}
                  <div className="bg-muted/40 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-bold text-xs">
                    <span className="text-foreground uppercase tracking-tight">
                      🏅 Subtotal do Profissional: <strong>{prof.professional_name}</strong> ({prof.total_patients} {prof.total_patients === 1 ? 'paciente' : 'pacientes'} | {prof.total_sessions} {prof.total_sessions === 1 ? 'sessão' : 'sessões'})
                    </span>
                    <div className="flex items-center gap-4 text-xs font-mono font-bold">
                      <span className="text-muted-foreground">SUS: <strong className="text-foreground">{formatCurrency(prof.total_sus)}</strong></span>
                      <span className="text-muted-foreground">RP: <strong className="text-foreground">{formatCurrency(prof.total_rp)}</strong></span>
                      <span className="text-primary font-black text-sm">Total: {formatCurrency(prof.total_value)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Grand Total Banner */}
            <div className="bg-card border-2 border-primary/30 rounded-[32px] p-6 shadow-xl shadow-primary/5 flex flex-col lg:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-black text-foreground tracking-tight">Total Geral Consolidado da Competência</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {grouped.overall.total_professionals} profissionais • {grouped.overall.total_patients} pacientes atendidos • {grouped.overall.total_sessions} sessões realizadas
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6 font-mono font-bold">
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Recurso SUS (Fed.)</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(grouped.overall.total_sus)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Recurso Próprio (Mun.)</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(grouped.overall.total_rp)}</span>
                </div>
                <div className="text-right pl-4 border-l border-border/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary block">Faturamento Total</span>
                  <span className="text-xl font-black text-primary">{formatCurrency(grouped.overall.total_value)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Default: Billing or Conference
    return (
      <div className="bg-card border border-border/50 rounded-[40px] shadow-sm overflow-hidden animate-in fade-in duration-700">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Paciente / CNS</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Profissional / CBO</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Procedimento</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Data</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">SUS (Federal)</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">RP (Municipal)</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {initialData.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors group">
                  <td className="p-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">{row.patient_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{row.patient_cns || 'SEM CNS'}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">{row.professional_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{row.professional_cbo || 'SEM CBO'}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-0.5 max-w-[200px]">
                      <span className="text-xs font-bold text-foreground truncate">{row.procedure_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{row.procedure_code || 'SEM CÓDIGO'}</span>
                    </div>
                  </td>
                  <td className="p-6 text-sm font-medium text-foreground">
                    {new Date(row.session_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                      row.status === 'Realizada' ? 'bg-emerald-500/10 text-emerald-500' :
                      row.status === 'Pendente' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <span className="text-sm font-black text-foreground">
                      {formatCurrency(row.valor_sus || 0)}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <span className="text-sm font-black text-foreground">
                      {formatCurrency(row.valor_rp || 0)}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <span className="text-sm font-black text-foreground">
                      {formatCurrency(row.value)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-black border-t-2 border-border/50">
              <tr>
                <td colSpan={5} className="p-6 text-[10px] uppercase tracking-widest text-muted-foreground text-right italic">Valor Total da Produção no Período:</td>
                <td className="p-6 text-right text-sm text-foreground/80 font-black">
                  {formatCurrency(initialData.reduce((acc, row) => acc + (Number(row.valor_sus) || 0), 0))}
                </td>
                <td className="p-6 text-right text-sm text-foreground/80 font-black">
                  {formatCurrency(initialData.reduce((acc, row) => acc + (Number(row.valor_rp) || 0), 0))}
                </td>
                <td className="p-6 text-right text-sm text-primary font-black">
                  {formatCurrency(initialData.reduce((acc, row) => acc + (Number(row.value) || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-8 border-t border-border/30 bg-muted/20 no-print">
          <Pagination 
            totalItems={totalCount} 
            itemsPerPage={itemsPerPage} 
            currentPage={currentPage} 
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
            <BarChart3 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground">Relatórios & BI</h1>
            <p className="text-muted-foreground font-medium">Análise estratégica e conferência de faturamento SUS.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 no-print">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-muted text-foreground hover:bg-muted/80 px-6 py-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
            disabled={!initialData || initialData.length === 0}
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
            disabled={!initialData || initialData.length === 0}
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 bg-card border border-border/50 p-4 rounded-[32px] shadow-sm overflow-x-auto no-scrollbar no-print">
        {[
          { id: 'grouped_billing', label: 'Por Profissional & Paciente', icon: Users },
          { id: 'billing', label: 'Produção Geral (Linear)', icon: FileText },
          { id: 'consistency', label: 'Inconsistências (Audit)', icon: ShieldAlert },
          { id: 'performance', label: 'Produtividade & Absenteísmo', icon: BarChart3 }
        ].map((t) => (
          <a
            key={t.id}
            href={`?type=${t.id}&competence_id=${selectedCompetenceId}&start_date=${startDate}&end_date=${endDate}&clinic_id=${selectedClinic}&professional_id=${selectedProfessional}&patient_id=${selectedPatient}&procedure_id=${selectedProcedure}&mode=${mode}`}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all shrink-0 ${type === t.id ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/10' : 'text-muted-foreground hover:bg-muted/50'}`}
          >
            <t.icon className={`h-4 w-4 ${type === t.id ? 'text-primary-foreground' : 'text-primary'}`} />
            <span className="text-xs font-black uppercase tracking-widest">{t.label}</span>
          </a>
        ))}
      </div>

      {/* Filters Form */}
      <form className="bg-card border border-border/50 rounded-[40px] p-8 shadow-sm no-print space-y-6">
        <input type="hidden" name="type" value={type} />
        
        {/* First Row: Period & Unit & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3 text-primary" />
              Competência
            </label>
            <select 
              name="competence_id" 
              defaultValue={selectedCompetenceId}
              onChange={handleCompetenceChange}
              disabled={isCustomPeriod}
              className={`w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none ${isCustomPeriod ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">Selecione a competência...</option>
              {filters.competences.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {String(c.month).padStart(2, '0')}/{c.year} ({c.status}){c.clinic?.name ? ` - ${c.clinic.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Settings2 className="h-3 w-3 text-primary" />
              Tipo Período
            </label>
            <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50 h-[46px]">
              <button
                type="button"
                onClick={() => setIsCustomPeriod(false)}
                className={`flex-1 rounded-xl text-[9px] font-black uppercase transition-all ${!isCustomPeriod ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Oficial
              </button>
              <button
                type="button"
                onClick={() => setIsCustomPeriod(true)}
                className={`flex-1 rounded-xl text-[9px] font-black uppercase transition-all ${isCustomPeriod ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3 text-primary/40" />
              Início
            </label>
            <input 
              type="date" 
              name="start_date" 
              defaultValue={startDate}
              disabled={!isCustomPeriod}
              className={`w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all ${!isCustomPeriod ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3 text-primary/40" />
              Fim
            </label>
            <input 
              type="date" 
              name="end_date" 
              defaultValue={endDate}
              disabled={!isCustomPeriod}
              className={`w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all ${!isCustomPeriod ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Building2 className="h-3 w-3 text-primary" />
              Unidade
            </label>
            <select 
              name="clinic_id" 
              defaultValue={selectedClinic}
              disabled={!['SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR'].includes(userRole)}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              {!['SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR'].includes(userRole) ? null : <option value="">Todas as Unidades</option>}
              {filters.clinics.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Filter className="h-3 w-3 text-primary" />
              Situação
            </label>
            <select 
              name="mode" 
              defaultValue={mode}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              <option value="official" disabled={!filters.competences.some((c: any) => c.status === 'FECHADA' || c.status === 'ENVIADA_MS')}>
                Oficial (Realizados) {!filters.competences.some((c: any) => c.status === 'FECHADA' || c.status === 'ENVIADA_MS') ? '- Indisponível' : ''}
              </option>
              <option value="preview">Prévia (Incluir Pendentes)</option>
              <option value="all">Geral (Todos)</option>
            </select>
          </div>
        </div>

        {/* Second Row: Specific Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <User className="h-3 w-3 text-primary" />
              Profissional
            </label>
            <select 
              name="professional_id" 
              defaultValue={selectedProfessional}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              <option value="">Todos os Profissionais</option>
              {filters.professionals.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3 text-primary" />
              Paciente
            </label>
            <select 
              name="patient_id" 
              defaultValue={selectedPatient}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              <option value="">Todos os Pacientes</option>
              {filters.patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3 text-primary" />
              Procedimento
            </label>
            <select 
              name="procedure_id" 
              defaultValue={selectedProcedure}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              <option value="">Todos os Procedimentos</option>
              {filters.procedures?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button 
              type="submit"
              className="w-full bg-foreground text-background hover:bg-foreground/90 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl shadow-foreground/10"
            >
              <Search className="h-4 w-4" />
              Filtrar Resultados
            </button>
          </div>
        </div>
      </form>

      {/* Results Table */}
      {renderTable()}
    </div>
  )
}
