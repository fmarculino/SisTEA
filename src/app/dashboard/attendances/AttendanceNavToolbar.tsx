'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowLeft, Search, Filter } from 'lucide-react'

export interface AttendanceNavData {
  prevId: string | null
  nextId: string | null
  currentIndex: number // 1-based index
  totalCount: number
  backUrl: string
  queryString: string
  activeSearch?: string | null
  activeFilterCount?: number
}

interface AttendanceNavToolbarProps {
  navigation: AttendanceNavData
}

export function AttendanceNavToolbar({ navigation }: AttendanceNavToolbarProps) {
  const router = useRouter()
  const { prevId, nextId, currentIndex, totalCount, backUrl, queryString, activeSearch, activeFilterCount } = navigation

  // Keyboard navigation: Left/Right arrows (when not typing in an input/textarea/select)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)
      
      if (isInput) return

      if (e.key === 'ArrowLeft' && prevId) {
        e.preventDefault()
        router.push(`/dashboard/attendances/${prevId}/edit${queryString ? `?${queryString}` : ''}`)
      } else if (e.key === 'ArrowRight' && nextId) {
        e.preventDefault()
        router.push(`/dashboard/attendances/${nextId}/edit${queryString ? `?${queryString}` : ''}`)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        router.push(backUrl)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevId, nextId, queryString, backUrl, router])

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Botão de Retorno à Lista com Filtros */}
      <div className="flex items-center gap-3">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-foreground bg-background hover:bg-muted border border-border/70 rounded-xl shadow-sm transition-all active:scale-95 group"
          title="Voltar para a listagem mantendo os filtros aplicados (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 group-hover:text-primary transition-transform" />
          <span>Voltar para Atendimentos</span>
        </Link>

        {activeSearch && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Search className="w-3 h-3" />
            <span className="truncate max-w-[150px]">"{activeSearch}"</span>
          </div>
        )}

        {activeFilterCount && activeFilterCount > 0 ? (
          <div className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-[11px] font-bold text-muted-foreground border border-border/50">
            <Filter className="w-3 h-3" />
            <span>{activeFilterCount} filtro(s)</span>
          </div>
        ) : null}
      </div>

      {/* Controles de Navegação Entre Procedimentos/Atendimentos Filtrados */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          {/* Botão Anterior */}
          {prevId ? (
            <Link
              href={`/dashboard/attendances/${prevId}/edit${queryString ? `?${queryString}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground bg-background hover:bg-muted border border-border/70 rounded-xl shadow-sm transition-all active:scale-95"
              title="Atendimento Anterior (Seta Esquerda)"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              <span className="hidden sm:inline">Anterior</span>
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-muted-foreground/40 bg-muted/40 border border-border/30 rounded-xl cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 opacity-40" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
          )}

          {/* Indicador de Posição */}
          <div className="flex items-center px-3.5 py-1.5 bg-muted/60 border border-border/50 rounded-xl font-mono text-xs font-bold text-foreground select-none">
            <span className="text-primary">{currentIndex}</span>
            <span className="text-muted-foreground mx-1.5">/</span>
            <span>{totalCount}</span>
            <span className="hidden md:inline ml-1.5 text-[10px] uppercase font-sans text-muted-foreground font-semibold">no filtro</span>
          </div>

          {/* Botão Próximo */}
          {nextId ? (
            <Link
              href={`/dashboard/attendances/${nextId}/edit${queryString ? `?${queryString}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-foreground bg-background hover:bg-muted border border-border/70 rounded-xl shadow-sm transition-all active:scale-95"
              title="Próximo Atendimento (Seta Direita)"
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-muted-foreground/40 bg-muted/40 border border-border/30 rounded-xl cursor-not-allowed"
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
