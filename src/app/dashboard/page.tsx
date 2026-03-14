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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral do mês ({date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-card border border-border shadow p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="truncate text-sm font-medium text-muted-foreground">Atendimentos Realizados (Mês)</dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{totalAttendances}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-card border border-border shadow p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="truncate text-sm font-medium text-muted-foreground">
                  {profile?.role === 'SMS_ADMIN' ? 'Valor Apurado (Global)' : 'Faturamento Estimado'}
                </dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(totalValue)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-card border border-border shadow p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="truncate text-sm font-medium text-muted-foreground">Pacientes Vinculados</dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{totalPatients}</dd>
              </dl>
            </div>
          </div>
        </div>

        {profile?.role === 'SMS_ADMIN' && (
          <div className="overflow-hidden rounded-lg bg-card border border-border shadow p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-muted-foreground">Clínicas Ativas</dt>
                  <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{totalClinicsActive}</dd>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
