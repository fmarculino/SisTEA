'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  emptyMessage = "Nenhum resultado encontrado",
  disabled = false,
  className = ""
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Memoize Fuse instance
  const fuse = useMemo(() => {
    return new Fuse(options, {
      keys: ['name', 'code'],
      threshold: 0.4, // Adjust for more/less fuzzy matching
      distance: 100,
      ignoreLocation: true,
    })
  }, [options])

  // Get current label
  const selectedOption = useMemo(() => 
    options.find(opt => opt.id === value), 
    [options, value]
  )

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return options
    return fuse.search(search).map(result => result.item)
  }, [fuse, search, options])

  // Handle click outside to close
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
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-11 w-full items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-2 text-sm shadow-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? 'ring-4 ring-primary/10 border-primary' : ''}`}
      >
        <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center border-b border-border/60 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
              placeholder="Buscar..."
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="p-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3 opacity-50" />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-4 text-sm text-muted-foreground italic justify-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-primary/10 hover:text-primary ${
                    value === option.id ? "bg-primary/5 text-primary font-medium" : "text-foreground"
                  }`}
                >
                  <span className="flex-1 text-left">{option.name}</span>
                  {value === option.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
