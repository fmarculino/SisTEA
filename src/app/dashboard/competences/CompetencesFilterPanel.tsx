'use client'

import { Search, Filter, HelpCircle } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface ClinicOption {
  id: string
  name: string
}

interface CompetencesFilterPanelProps {
  isAdmin: boolean
  clinicsList: ClinicOption[]
}

export function CompetencesFilterPanel({ isAdmin, clinicsList }: CompetencesFilterPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const showClosed = searchParams.get('show_closed') === 'true'

  // Helper para atualizar múltiplos parâmetros na URL
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    // Sempre reseta para a página 1 ao alterar filtros
    params.delete('page')

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [searchParams, pathname, router])

  // Debounce para o input de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (searchParams.get('q') || '')) {
        updateParams({ q: searchValue })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchValue, searchParams, updateParams])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  const handleToggleClosed = () => {
    updateParams({ show_closed: !showClosed ? 'true' : null })
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 transition-all hover:border-border/60">
      
      {/* Lado Esquerdo: Busca e Filtro de Clínicas */}
      <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-4">
        
        {/* Barra de Pesquisa */}
        <div className="relative flex-1 min-w-[260px] group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2.5 border border-border bg-card/60 backdrop-blur-sm rounded-xl text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground/60"
            placeholder={isAdmin ? "Pesquisar por clínica ou período (ex: 05/2026)..." : "Pesquisar por período (ex: Maio 2026)..."}
            value={searchValue}
            onChange={handleSearchChange}
          />
        </div>

        {/* Filtros Ativos Indicador */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 rounded-xl border border-border/40 w-fit self-start sm:self-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Filtros</span>
        </div>

        {/* Seletor de Clínicas (Somente SMS_ADMIN) */}
        {isAdmin && (
          <div className="relative min-w-[200px]">
            <select
              className="w-full h-10 pl-3 pr-9 py-2 text-sm border border-border bg-card/80 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer hover:bg-card hover:border-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              value={searchParams.get('clinic') || 'all'}
              onChange={(e) => updateParams({ clinic: e.target.value })}
            >
              <option value="all">Todas as Clínicas</option>
              {clinicsList.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lado Direito: Chave Toggle de Competências Encerradas */}
      <div className="flex items-center justify-between sm:justify-start gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-border/20">
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase text-foreground tracking-wider leading-none">
            Visualizar Encerradas
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold mt-1">
            Exibe competências com status Fechada/Enviada
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Switch IOS-Style */}
          <button
            type="button"
            onClick={handleToggleClosed}
            disabled={isPending}
            className={`w-12 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              showClosed ? 'bg-primary' : 'bg-muted border border-border/40'
            } ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={showClosed}
          >
            {/* Knob do Switch */}
            <span
              className={`w-5 h-5 bg-white dark:bg-slate-100 rounded-full absolute top-0.5 shadow-md transition-transform duration-200 ease-in-out ${
                showClosed ? 'translate-x-6 left-0.5' : 'translate-x-0 left-0.5'
              }`}
            />
          </button>

          {/* Label de feedback ao lado do Switch */}
          <span
            className={`text-xs font-black tracking-widest uppercase transition-colors min-w-[28px] ${
              showClosed ? 'text-primary' : 'text-muted-foreground/60'
            }`}
          >
            {showClosed ? 'SIM' : 'NÃO'}
          </span>
        </div>
      </div>
    </div>
  )
}
