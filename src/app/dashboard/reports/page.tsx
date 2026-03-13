import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { FileText } from 'lucide-react'
import { formatCurrency } from '@/utils/format'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams

  const profile = await getUserProfile()
  const supabase = await createClient()

  // Default to current YYYY-MM
  const date = new Date()
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = month || currentMonth

  // Parse first and last day of selected month
  const [yearStr, monthStr] = selectedMonth.split('-')
  const y = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10) - 1
  const firstDay = new Date(y, m, 1).toISOString()
  const lastDay = new Date(y, m + 1, 0).toISOString()

  let query = supabase.from('attendances').select(`
    id,
    attendance_date,
    status,
    value_applied,
    clinic:clinics(name),
    professional:professionals(name),
    procedure:procedures(name)
  `)
  .gte('attendance_date', firstDay)
  .lte('attendance_date', lastDay)

  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    query = query.eq('clinic_id', profile.clinic_id)
  }

  const { data: attendances } = await query

  // Agrupar por clínica -> profissional
  const reportData: Record<string, any> = {}

  ;(attendances as any[])?.forEach(att => {
    const cName = att.clinic?.name || 'Desconhecida'
    const defaultVal = 0
    const val = att.status === 'present' ? (att.value_applied || 0) : 0

    if (!reportData[cName]) {
      reportData[cName] = { totalValue: 0, professionals: {} }
    }

    const pName = att.professional?.name || 'Desconhecido'
    if (!reportData[cName].professionals[pName]) {
      reportData[cName].professionals[pName] = { count: 0, value: 0 }
    }

    reportData[cName].professionals[pName].count += 1
    reportData[cName].professionals[pName].value += val
    reportData[cName].totalValue += val
  })


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight flex items-center">
            <FileText className="mr-2 h-6 w-6 text-muted-foreground" />
            Relatórios de Conferência
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumo de faturamento por clínica e profissional
          </p>
        </div>
        
        <form className="flex items-center space-x-2">
          <label htmlFor="month" className="text-sm font-medium text-foreground">Mês base:</label>
          <input 
            type="month" 
            name="month" 
            id="month" 
            defaultValue={selectedMonth}
            className="rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-3 py-2 border bg-background text-foreground"
          />
          <button type="submit" className="rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-accent hover:text-accent-foreground">
            Filtrar
          </button>
        </form>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-lg border border-border">
        {Object.keys(reportData).length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Nenhum dado encontrado para este mês.</div>
        ) : (
          <div className="px-4 py-5 sm:p-6 space-y-8">
            {Object.entries(reportData).map(([clinicName, clinicData]) => (
              <div key={clinicName} className="border-b border-border pb-6 last:border-0 last:pb-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-foreground">{clinicName}</h3>
                  <span className="text-lg font-semibold text-green-500">Total: {formatCurrency(clinicData.totalValue as number)}</span>
                </div>
                
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Profissional</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Atendimentos</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Gerado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {Object.entries(clinicData.professionals as any).map(([profName, profData]: any) => (
                      <tr key={profName}>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-foreground">{profName}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{profData.count}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{formatCurrency(profData.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
