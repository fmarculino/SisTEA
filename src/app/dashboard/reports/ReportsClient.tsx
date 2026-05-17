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
  Settings2
} from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { Pagination } from '@/components/ui/Pagination'
import * as XLSX from 'xlsx'
import { createReportRequest } from './actions'

interface ReportsClientProps {
  initialData: any[]
  totalCount: number
  currentPage: number
  itemsPerPage: number
  type: 'conference' | 'billing' | 'performance' | 'consistency'
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

    const worksheet = XLSX.utils.json_to_sheet(initialData)
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
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Não Realizado</th>
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
                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Valor</th>
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
                      <span className="text-[10px] text-muted-foreground font-mono">{row.procedure_code}</span>
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
                      {formatCurrency(row.value)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-black border-t-2 border-border/50">
              <tr>
                <td colSpan={5} className="p-6 text-[10px] uppercase tracking-widest text-muted-foreground text-right italic">Valor Total da Produção no Período:</td>
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
          { id: 'billing', label: 'Produção / Faturamento', icon: FileText },
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
              className={`w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none ${isCustomPeriod ? 'opacity-50' : ''}`}
            >
              <option value="">Selecione...</option>
              {filters.competences.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {String(c.month).padStart(2, '0')}/{c.year} ({c.status})
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
              readOnly={!isCustomPeriod}
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
              readOnly={!isCustomPeriod}
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
              disabled={userRole === 'CLINIC_USER'}
              className="w-full bg-muted/30 border border-border/50 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none"
            >
              <option value="">Todas as Unidades</option>
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
