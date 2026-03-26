import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { Users, Activity, Building, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { DashboardFilters } from './DashboardFilters'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const profile = await getUserProfile()
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
  let totalValue = 0
  let totalPatients = 0
  let totalClinicsActive = 0
  let clinicStats: { name: string; count: number; value: number }[] = []

  if (profile?.role === 'SMS_ADMIN') {
    let sessionsQuery = supabase.from('attendance_sessions')
      .select(`
        status,
        attendance:attendances!inner(
          clinic:clinics!inner(name),
          procedure:procedures!inner(valor_total)
        )
      `)
      .eq('status', 'Realizada')

    if (firstDay && lastDay) {
      sessionsQuery = sessionsQuery.gte('session_date', firstDay).lte('session_date', lastDay)
    }

    const [sessionsRes, clinicsRes, patientsRes] = await Promise.all([
      sessionsQuery,
      supabase.from('clinics').select('id', { count: 'exact' }).eq('active', true),
      supabase.from('patients').select('id', { count: 'exact' })
    ])

    const sessions = sessionsRes.data || []
    totalAttendances = sessions.length
    
    // Grouping by clinic
    const statsMap = new Map<string, { count: number; value: number }>()
    
    sessions.forEach((s: any) => {
      const clinicName = s.attendance?.clinic?.name || 'Clínica não identificada'
      const val = Number(s.attendance?.procedure?.valor_total) || 0
      
      totalValue += val
      
      const current = statsMap.get(clinicName) || { count: 0, value: 0 }
      statsMap.set(clinicName, {
        count: current.count + 1,
        value: current.value + val
      })
    })

    clinicStats = Array.from(statsMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.value - a.value)
    
    totalClinicsActive = clinicsRes.count || 0
    totalPatients = patientsRes.count || 0
  } else {
    // CLINIC_USER
    const clinicId = profile?.clinic_id
    if (clinicId) {
      let sessionsQuery = supabase.from('attendance_sessions')
        .select(`
          status,
          attendance:attendances!inner(
            clinic_id,
            clinic:clinics!inner(name),
            procedure:procedures!inner(valor_total)
          )
        `)
        .eq('attendance.clinic_id', clinicId)
        .eq('status', 'Realizada')

      if (firstDay && lastDay) {
        sessionsQuery = sessionsQuery.gte('session_date', firstDay).lte('session_date', lastDay)
      }

      const [sessionsRes, patientsRes] = await Promise.all([
        sessionsQuery,
        supabase.from('patients').select('id', { count: 'exact' }).eq('clinic_id', clinicId)
      ])

      const sessions = sessionsRes.data || []
      totalAttendances = sessions.length
      
      const statsMap = new Map<string, { count: number; value: number }>()

      sessions.forEach((s: any) => {
        const clinicName = s.attendance?.clinic?.name || 'Minha Clínica'
        const val = Number(s.attendance?.procedure?.valor_total) || 0
        totalValue += val

        const current = statsMap.get(clinicName) || { count: 0, value: 0 }
        statsMap.set(clinicName, {
          count: current.count + 1,
          value: current.value + val
        })
      })

      clinicStats = Array.from(statsMap.entries()).map(([name, stats]) => ({ name, ...stats }))
      totalPatients = patientsRes.count || 0
    }
  }

  const monthLabels = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const periodLabel = selectedYear 
    ? (selectedMonth ? `${monthLabels[selectedMonth - 1]} de ${selectedYear}` : `Ano de ${selectedYear}`)
    : 'Todo o Período'

  // Max value for chart scaling
  const maxValue = clinicStats.reduce((max, c) => Math.max(max, c.value), 0) || 1

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
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total de Atendimentos</p>
            <h3 className="text-3xl font-heading font-bold text-foreground">
              {totalAttendances}
            </h3>
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

        {/* Clínicas Card */}
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
              {profile?.role === 'SMS_ADMIN' ? 'Clínicas Ativas' : 'Minha Clínica'}
            </p>
            <h3 className="text-3xl font-heading font-bold text-foreground">
              {profile?.role === 'SMS_ADMIN' ? totalClinicsActive : 1}
            </h3>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <Building className="h-24 w-24 text-amber-600" />
          </div>
        </div>
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
            {clinicStats.map((clinic, index) => (
              <div key={clinic.name} className="space-y-3 group">
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-background border border-border/40 text-[10px] font-black group-hover:border-primary group-hover:text-primary transition-colors">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <span className="text-sm font-black text-foreground block group-hover:text-primary transition-colors cursor-default">{clinic.name}</span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/5 px-1.5 py-0.5 rounded">
                        {clinic.count} {clinic.count === 1 ? 'Atendimento' : 'Atendimentos'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-foreground block">{formatCurrency(clinic.value)}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{((clinic.value / totalValue) * 100).toFixed(1)}% do total</span>
                  </div>
                </div>
                
                {/* Custom Progress Bar Chart */}
                <div className="relative h-4 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                    style={{ width: `${(clinic.value / maxValue) * 100}%` }}
                  />
                  {/* Subtle stripes overlay */}
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
