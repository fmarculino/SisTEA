import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { Users, Activity, Building, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/utils/format'

export default async function DashboardPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Data ranges (simplificado para o mês atual)
  const date = new Date()
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString()

  let totalAttendances = 0
  let totalValue = 0
  let totalPatients = 0
  let totalClinicsActive = 0

  if (profile?.role === 'SMS_ADMIN') {
    const [attRes, clinicsRes, patientsRes] = await Promise.all([
      supabase.from('attendances')
        .select('value_applied')
        .gte('attendance_date', firstDay)
        .lte('attendance_date', lastDay),
      supabase.from('clinics').select('id', { count: 'exact' }).eq('active', true),
      supabase.from('patients').select('id', { count: 'exact' })
    ])

    totalAttendances = attRes.data?.length || 0
    totalValue = attRes.data?.reduce((acc, curr) => acc + (curr.value_applied || 0), 0) || 0
    totalClinicsActive = clinicsRes.count || 0
    totalPatients = patientsRes.count || 0
  } else {
    // CLINIC_USER
    const clinicId = profile?.clinic_id
    if (clinicId) {
      const [attRes, patientsRes] = await Promise.all([
        supabase.from('attendances')
          .select('value_applied')
          .eq('clinic_id', clinicId)
          .gte('attendance_date', firstDay)
          .lte('attendance_date', lastDay),
        supabase.from('patients').select('id', { count: 'exact' }).eq('clinic_id', clinicId)
      ])

      totalAttendances = attRes.data?.length || 0
      totalValue = attRes.data?.reduce((acc, curr) => acc + (curr.value_applied || 0), 0) || 0
      totalPatients = patientsRes.count || 0
    }
  }


  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Painel de <span className="text-primary tracking-tighter">Controle</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl italic">
          Visão geral do mês de <span className="text-foreground font-bold capitalize">{date.toLocaleString('pt-BR', { month: 'long' })}</span> de <span className="text-foreground font-bold">{date.getFullYear()}</span>
        </p>
      </div>

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
            <p className="text-sm font-medium text-muted-foreground mb-1">Atendimentos (Mês)</p>
            <h3 className="text-3xl font-heading font-bold text-foreground">
              {totalAttendances}
            </h3>
          </div>
          {/* Subtle background decoration */}
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

        {/* Clínicas Admin Card */}
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
              <p className="text-sm font-medium text-muted-foreground mb-1">Clínicas Ativas</p>
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
    </div>
  )
}
