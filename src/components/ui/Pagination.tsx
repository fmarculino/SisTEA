'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface PaginationProps {
  totalItems: number
  itemsPerPage: number
  currentPage: number
}

export function Pagination({ totalItems, itemsPerPage, currentPage }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  const createQueryString = (params: Record<string, string | number | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    
    for (const [key, value] of Object.entries(params)) {
      if (value === null) {
        newSearchParams.delete(key)
      } else {
        newSearchParams.set(key, value.toString())
      }
    }
    
    return newSearchParams.toString()
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    router.push(`${pathname}?${createQueryString({ page })}`)
  }

  const changeLimit = (limit: string) => {
    router.push(`${pathname}?${createQueryString({ page: 1, limit })}`)
  }

  if (totalItems === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 px-8 bg-card/30 backdrop-blur-md border-t border-border/20 rounded-b-[2rem]">
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.1em]">
          Mostrando <span className="text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> -{' '}
          <span className="text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de{' '}
          <span className="text-foreground">{totalItems}</span> registros
        </p>
        
        <div className="flex items-center gap-3 bg-muted/50 p-1 px-3 rounded-xl border border-border/50">
          <p className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Exibir</p>
          <select 
            value={itemsPerPage}
            onChange={(e) => changeLimit(e.target.value)}
            className="bg-transparent text-xs font-black text-primary outline-none cursor-pointer hover:scale-105 transition-transform"
          >
            <option value="20" className="bg-card text-foreground">20</option>
            <option value="30" className="bg-card text-foreground">30</option>
            <option value="50" className="bg-card text-foreground">50</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center bg-card shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-20 disabled:hover:bg-card disabled:hover:text-foreground disabled:hover:border-border/40 transition-all active:scale-90"
            title="Primeira página"
          >
            <ChevronsLeft className="h-4 w-4 stroke-[2.5]" />
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center bg-card shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-20 disabled:hover:bg-card disabled:hover:text-foreground disabled:hover:border-border/40 transition-all active:scale-90"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
        
        <div className="flex items-center bg-muted/50 rounded-xl px-4 py-2 border border-border/40 shadow-inner">
          <span className="text-xs font-black text-foreground">{currentPage}</span>
          <span className="mx-2 text-[10px] font-bold text-muted-foreground uppercase opacity-50">de</span>
          <span className="text-xs font-black text-foreground">{totalPages || 1}</span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center bg-card shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-20 disabled:hover:bg-card disabled:hover:text-foreground disabled:hover:border-border/40 transition-all active:scale-90"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center bg-card shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-20 disabled:hover:bg-card disabled:hover:text-foreground disabled:hover:border-border/40 transition-all active:scale-90"
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  )
}
