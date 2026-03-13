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
    <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-input bg-background rounded-md text-sm shadow-sm focus:ring-1 focus:ring-primary focus:border-primary"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        
        {extraFilters.map((filter) => (
          <select
            key={filter.paramName}
            className="block w-full sm:w-auto py-2 pl-3 pr-10 text-sm border border-input bg-background rounded-md focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
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
            className="block w-full sm:w-40 py-2 pl-3 pr-10 text-sm border border-input bg-background rounded-md focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
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
