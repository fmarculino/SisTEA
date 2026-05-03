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

  if (totalPages <= 1 && itemsPerPage === 25) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground font-medium">
          Mostrando <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
          <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de{' '}
          <span className="font-bold text-foreground">{totalItems}</span> registros
        </p>
        
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Itens por página</p>
          <select 
            value={itemsPerPage}
            onChange={(e) => changeLimit(e.target.value)}
            className="bg-card border border-border/50 rounded-lg text-xs font-bold py-1 px-2 outline-none focus:border-primary/50 transition-all cursor-pointer"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-1 px-2">
          <span className="text-xs font-bold text-foreground">{currentPage}</span>
          <span className="text-xs text-muted-foreground">de</span>
          <span className="text-xs font-bold text-foreground">{totalPages}</span>
        </div>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
