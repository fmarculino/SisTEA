import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { Users, Activity, Building, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { DashboardFilters } from './DashboardFilters'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const profile = await getUserProfile()

  if (profile?.role === 'RECEPCIONISTA' || profile?.role === 'FATURISTA') {
    redirect('/dashboard/attendances')
  }

  const supabase = await createClient()

  // Date ranges based on params
  const date = new Date()
  const selectedYear = params.year === 'all' ? null : (params.year ? parseInt(params.year) : date.getFullYear())
  const selectedMonth = params.month === 'all' || !selectedYear ? null : (params.month ? parseInt(params.month) : date.getMonth() + 1)
  
  let firstDay: string | null = null
  let lastDay: string | null = null

  if (selectedYear) {
    if (selectedMonth) {
      firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      lastDay = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
    } else {
      // Todos os meses do ano selecionado
      firstDay = `${selectedYear}-01-01`
      lastDay = `${selectedYear}-12-31`
    }
  }

  let totalAttendances = 0
  let totalSessions = 0
  let totalValue = 0
  let totalPatients = 0
  let totalClinicsActive = 0
  let clinicStats: { name: string; count: number; attendance_count: number; value: number }[] = []
  let digitalValidatedCount = 0

  const clinicId = profile?.role === 'SMS_ADMIN' ? null : profile?.clinic_id

  // Execute optimized stats query via RPC
  const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats', {
    p_clinic_id: clinicId,
    p_start_date: firstDay,
    p_end_date: lastDay
  })

  if (!statsError && statsData) {
    totalAttendances = statsData.total_attendances || 0
    totalSessions = statsData.total_sessions || 0
    totalValue = statsData.total_value || 0
    digitalValidatedCount = statsData.digital_validated || 0
    clinicStats = statsData.clinic_stats || []
  }

  // Fetch counts for Clinics and Patients separately
  if (profile?.role === 'SMS_ADMIN') {
    const [clinicsRes, patientsRes] = await Promise.all([
      supabase.from('clinics').select('id', { count: 'exact' }).eq('active', true),
      supabase.from('patients').select('id', { count: 'exact' })
    ])
    totalClinicsActive = clinicsRes.count || 0
    totalPatients = patientsRes.count || 0
  } else if (clinicId) {
    const { count } = await supabase
      .from('patient_clinics')
      .select('id', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .eq('active', true)
    totalPatients = count || 0
  }

  // Fetch clinics and their active contracts to show contract balances in the list
  const [clinicsListRes, contractsListRes] = await Promise.all([
    supabase.from('clinics').select('id, name'),
    supabase.from('contracts').select('clinic_id, valor_total, valor_saldo, contract_number').eq('active', true)
  ])
  const clinicsList = clinicsListRes.data || []
  const contractsList = contractsListRes.data || []

  const monthLabels = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const periodLabel = selectedYear 
    ? (selectedMonth ? `${monthLabels[selectedMonth - 1]} de ${selectedYear}` : `Ano de ${selectedYear}`)
    : 'Todo o Período'

  // Max value for chart scaling
  const maxValue = clinicStats.reduce((max, c) => Math.max(max, c.value), 0) || 1

  // Digital Validation Stats
  const digitalValidationRate = totalSessions > 0 
    ? (digitalValidatedCount / totalSessions) * 100 
    : 0

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Painel de <span className="text-primary tracking-tighter">Controle</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl italic">
            Visão geral do período: <span className="text-foreground font-bold capitalize">{periodLabel}</span>
          </p>
        </div>
        
        <DashboardFilters />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Atendimentos Card */}
        <div className="bento-card p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-full">Atividade</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mb-1">Atendimentos</p>
              <h3 className="text-3xl font-heading font-bold text-foreground">
                {totalAttendances}
              </h3>
            </div>
            <div className="border-l border-border/40 pl-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mb-1">Frequências</p>
              <h3 className="text-3xl font-heading font-bold text-foreground">
                {totalSessions}
              </h3>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <Activity className="h-24 w-24 text-primary" />
          </div>
        </div>

        {/* Faturamento Card */}
        <div className="bento-card p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/5 px-2 py-0.5 rounded-full">Monetário</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {profile?.role === 'SMS_ADMIN' ? 'Valor Apurado' : 'Faturamento Est.'}
            </p>
            <h3 className="text-3xl font-heading font-bold text-foreground">
              {formatCurrency(totalValue)}
            </h3>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <DollarSign className="h-24 w-24 text-emerald-600" />
          </div>
        </div>

        {/* Pacientes Card */}
        <div className="bento-card p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-500/5 px-2 py-0.5 rounded-full">Pacientes</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Pacientes Vinculados</p>
            <h3 className="text-3xl font-heading font-bold text-foreground">
              {totalPatients}
            </h3>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <Users className="h-24 w-24 text-blue-600" />
          </div>
        </div>

        {/* Taxa de Validação Digital Card */}
        <div className="bento-card p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/5 px-2 py-0.5 rounded-full">Auditoria</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Adoção Digital (QR Code)</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-heading font-bold text-foreground">
                {digitalValidationRate.toFixed(1)}%
              </h3>
              <span className="text-xs text-muted-foreground">da produção</span>
            </div>
            <div className="mt-3 h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${digitalValidationRate}%` }}
              />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <ShieldCheck className="h-24 w-24 text-emerald-600" />
          </div>
        </div>

        {/* Clínicas Card - Only for Admin */}
        {profile?.role === 'SMS_ADMIN' && (
          <div className="bento-card p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Building className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/5 px-2 py-0.5 rounded-full">Gestão</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Clínicas Ativas
              </p>
              <h3 className="text-3xl font-heading font-bold text-foreground">
                {totalClinicsActive}
              </h3>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <Building className="h-24 w-24 text-amber-600" />
            </div>
          </div>
        )}
      </div>

      {/* Clínicas Performance Chart */}
      <div className="bento-card p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Movimentação por Clínica</h3>
            <p className="text-xs text-muted-foreground font-medium">Análise de produção e faturamento por unidade</p>
          </div>
        </div>

        {clinicStats.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-4 border border-dashed border-border/60">
              <Activity className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground italic font-medium">Nenhuma atividade registrada no período selecionado.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {clinicStats.map((clinic, index) => {
              const matchedClinic = clinicsList.find(cl => cl.name === clinic.name)
              const contract = matchedClinic ? contractsList.find(co => co.clinic_id === matchedClinic.id) : null
              
              let valorTotal = 0
              let valorSaldo = 0
              let valorConsumido = 0
              let consumoPercent = 0
              
              if (contract) {
                valorTotal = Number(contract.valor_total || 0)
                valorSaldo = Number(contract.valor_saldo || 0)
                valorConsumido = valorTotal - valorSaldo
                consumoPercent = valorTotal > 0 ? (valorConsumido / valorTotal) * 100 : 0
              }

              // Color matching logic based on consumption
              let barColorClass = 'bg-gradient-to-r from-emerald-500/80 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              let textStatusColorClass = 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              
              if (consumoPercent >= 60 && consumoPercent < 90) {
                barColorClass = 'bg-gradient-to-r from-amber-500/80 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                textStatusColorClass = 'text-amber-600 dark:text-amber-400 font-extrabold'
              } else if (consumoPercent >= 90) {
                barColorClass = 'bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                textStatusColorClass = 'text-rose-600 dark:text-rose-400 font-extrabold'
              }

              return (
                <div key={clinic.name} className="p-5 rounded-2xl border border-border/30 bg-muted/5 hover:bg-muted/10 transition-all duration-300 space-y-4 shadow-sm hover:shadow-md">
                  {/* Cabeçalho do item da clínica */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-background border border-border/40 text-[10px] font-black text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <span className="text-sm font-black text-foreground block tracking-tight">{clinic.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/5 px-1.5 py-0.5 rounded">
                            {clinic.attendance_count || 0} Atend.
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter bg-muted/10 px-1.5 py-0.5 rounded">
                            {clinic.count} Freq.
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Resumo da produção */}
                    <div className="flex items-center gap-4 text-right md:self-center self-start pl-11 md:pl-0">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider text-[9px]">Faturamento Período</span>
                        <span className="text-sm font-black text-foreground">{formatCurrency(clinic.value)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lista de Barras Empilhadas (Uma sobre a outra) */}
                  <div className="space-y-4 pl-0 md:pl-11">
                    {/* Barra 1: Participação na Produção do Município */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                        <span>Participação na Produção</span>
                        <span className="text-foreground">{((clinic.value / totalValue) * 100).toFixed(1)}% do faturamento total</span>
                      </div>
                      <div className="relative h-2.5 w-full bg-muted/30 rounded-full overflow-hidden border border-border/10">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(var(--primary),0.2)]"
                          style={{ width: `${(clinic.value / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Barra 2: Consumo do Contrato */}
                    <div className="space-y-1.5">
                      {contract ? (
                        <>
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                            <span className="text-muted-foreground">Consumo do Contrato {contract.contract_number}</span>
                            <span className={textStatusColorClass}>
                              {consumoPercent.toFixed(1)}% consumido ({formatCurrency(valorSaldo)} restante)
                            </span>
                          </div>
                          <div className="relative h-2.5 w-full bg-muted/30 rounded-full overflow-hidden border border-border/10">
                            <div 
                              className={`absolute top-0 left-0 h-full ${barColorClass} rounded-full transition-all duration-1000 ease-out`}
                              style={{ width: `${Math.min(consumoPercent, 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground/60 uppercase">
                            <span>Contrato de Prestação de Contas</span>
                            <span className="italic text-muted-foreground/40 font-medium">Sem contrato ativo registrado para esta clínica</span>
                          </div>
                          <div className="relative h-2.5 w-full bg-muted/20 rounded-full overflow-hidden border border-border/10 border-dashed">
                            <div className="absolute inset-0 bg-muted/10" style={{ width: '0%' }} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
