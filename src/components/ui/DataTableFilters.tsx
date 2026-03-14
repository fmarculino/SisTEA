'use client'

import { Search, Filter } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface DataTableFiltersProps {
  placeholder?: string
  showStatus?: boolean
  extraFilters?: {
    paramName: string;
    placeholder: string;
    options: { value: string; label: string }[];
  }[];
}

export function DataTableFilters({ 
  placeholder = "Pesquisar...", 
  showStatus = true,
  extraFilters = []
}: DataTableFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')

  // Update URL when filters change
  const updateParams = useCallback((name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(name, value)
    } else {
      params.delete(name)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, pathname, router])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (searchParams.get('q') || '')) {
        updateParams('q', searchValue)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue, searchParams, updateParams])

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8 items-stretch sm:items-center flex-wrap">
      <div className="relative flex-1 min-w-[280px] group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-4 py-2.5 border border-border bg-card/50 backdrop-blur-sm rounded-xl text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground/60"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border/50">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filtros</span>
        </div>

        {extraFilters.map((filter) => (
          <select
            key={filter.paramName}
            className="h-10 pl-3 pr-9 py-2 text-sm border border-border bg-card/80 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-w-[180px] cursor-pointer hover:bg-card hover:border-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
            value={searchParams.get(filter.paramName) || 'all'}
            onChange={(e) => updateParams(filter.paramName, e.target.value)}
          >
            <option value="all">{filter.placeholder}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {showStatus && (
          <select
            className="h-10 pl-3 pr-9 py-2 text-sm border border-border bg-card/80 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-w-[140px] cursor-pointer hover:bg-card hover:border-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
            value={searchParams.get('status') || 'all'}
            onChange={(e) => updateParams('status', e.target.value)}
          >
            <option value="all">Todos Status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        )}
      </div>
    </div>
  )
}
