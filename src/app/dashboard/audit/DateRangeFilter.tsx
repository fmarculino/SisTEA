'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, X } from 'lucide-react'

export function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Default to last 30 days if no dates provided
  const getDefaultDates = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }

  const defaultDates = getDefaultDates()
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || defaultDates.start)
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || defaultDates.end)

  useEffect(() => {
    if (searchParams.get('startDate') || searchParams.get('endDate')) {
      setStartDate(searchParams.get('startDate') || '')
      setEndDate(searchParams.get('endDate') || '')
    }
  }, [searchParams])

  const handleFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (startDate) params.set('startDate', startDate)
    else params.delete('startDate')
    
    if (endDate) params.set('endDate', endDate)
    else params.delete('endDate')
    
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('startDate')
    params.delete('endDate')
    params.set('page', '1')
    setStartDate('')
    setEndDate('')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="space-y-2 flex-1 min-w-[140px]">
        <div className="flex items-center justify-between px-1">
          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Início</label>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/50" />
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-muted/20 border border-border/20 rounded-xl text-[10px] font-bold focus:border-primary/50 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center justify-between px-1">
          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Fim</label>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/50" />
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-muted/20 border border-border/20 rounded-xl text-[10px] font-bold focus:border-primary/50 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleFilter}
          className="px-6 h-[72px] bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center group"
        >
          <span className="group-hover:scale-110 transition-transform">Filtrar</span>
        </button>
        {(searchParams.get('startDate') || searchParams.get('endDate')) && (
          <button
            onClick={clearFilter}
            className="h-8 w-full bg-muted/50 text-muted-foreground flex items-center justify-center rounded-lg hover:bg-muted transition-all text-[9px] font-bold uppercase"
          >
            <X className="h-3 w-3 mr-1" /> Limpar
          </button>
        )}
      </div>
    </div>
  )
}
