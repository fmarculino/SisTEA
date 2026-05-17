'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { Check, Search, X, Plus } from 'lucide-react'

interface Option {
  id: string;
  name: string;
  code?: string;
  [key: string]: any;
}

interface MultiSearchSelectProps {
  options: Option[];
  value: string[]; // Array de IDs selecionados
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  renderTags?: boolean;
}

export function MultiSearchSelect({
  options,
  value = [],
  onChange,
  placeholder = "Buscar e adicionar...",
  emptyMessage = "Nenhum resultado encontrado",
  disabled = false,
  className = "",
  label,
  renderTags = true
}: MultiSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Fuse para busca difusa (nome e código)
  const fuse = useMemo(() => {
    return new Fuse(options, {
      keys: ['name', 'code', 'cbo', 'service_code', 'classification_code'],
      threshold: 0.3,
      distance: 100,
      ignoreLocation: true,
    })
  }, [options])

  // Itens selecionados para exibição
  const selectedOptions = useMemo(() => 
    options.filter(opt => value.includes(opt.id)), 
    [options, value]
  )

  // Filtrar opções (removendo as que já foram selecionadas)
  const filteredOptions = useMemo(() => {
    const available = options.filter(opt => !value.includes(opt.id))
    if (!search) return available.slice(0, 50) // Limita a 50 iniciais para performance
    return fuse.search(search).map(result => result.item).filter(opt => !value.includes(opt.id))
  }, [fuse, search, options, value])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onChange([...value, id])
    setSearch('')
    // Mantemos aberto para múltiplas seleções rápidas se houver busca, 
    // ou fechamos se for apenas clique direto
    if (!search) setIsOpen(false)
  }

  const handleRemove = (id: string) => {
    onChange(value.filter(v => v !== id))
  }

  return (
    <div className={`space-y-3 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest">
          {label}
        </label>
      )}
      
      <div className="relative">
        <div 
          className={`flex min-h-[3rem] w-full items-center rounded-2xl border border-border/60 bg-background/50 backdrop-blur-sm px-4 py-2 text-sm shadow-sm transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <Search className="mr-3 h-4 w-4 shrink-0 opacity-50 text-primary" />
          <input
            className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/60 font-medium"
            placeholder={placeholder}
            disabled={disabled}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
          />
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="relative flex cursor-default select-none items-center rounded-xl px-2 py-6 text-sm text-muted-foreground italic justify-center">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-xl px-3 py-3 text-sm outline-none transition-all hover:bg-primary/10 group"
                  >
                    <div className="flex flex-col items-start flex-1 text-left">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {option.name}
                      </span>
                      {(option.code || option.service_code || option.cbo) && (
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md mt-1 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                          {option.cbo ? `CBO: ${option.cbo}` : (option.code || `${option.service_code}/${option.classification_code}`)}
                        </span>
                      )}
                    </div>
                    <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tags Selecionadas */}
      {renderTags && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <div 
              key={option.id}
              className="inline-flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs font-bold text-primary animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <span className="max-w-[200px] truncate">
                {(option.code || option.cbo) && `[${option.code || option.cbo}] `}
                {option.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(option.id)}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3 stroke-[3]" />
              </button>
            </div>
          ))}
          {selectedOptions.length === 0 && !isOpen && (
            <p className="text-[10px] text-muted-foreground italic px-1">Nenhum item selecionado.</p>
          )}
        </div>
      )}
    </div>
  )
}
