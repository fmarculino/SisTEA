'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'

export function DashboardFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const currentMonth = searchParams.get('month') || (new Date().getMonth() + 1).toString()
  const currentYear = searchParams.get('year') || new Date().getFullYear().toString()

  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString())

  const handleFilterChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' && name === 'month') {
      params.set('month', 'all')
    } else {
      params.set(name, value)
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 bg-card/50 backdrop-blur-sm p-4 rounded-2xl border border-border/40 shadow-sm mb-8">
      <div className="flex items-center gap-2 text-muted-foreground mr-2">
        <Calendar className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Período</span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={currentMonth}
          onChange={(e) => handleFilterChange('month', e.target.value)}
          className="bg-background border border-border/60 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
        >
          <option value="all">Todos os Meses</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select
          value={currentYear}
          onChange={(e) => handleFilterChange('year', e.target.value)}
          className="bg-background border border-border/60 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
        >
          <option value="all">Todos os Anos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
