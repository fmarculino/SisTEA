'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { acceptTermAction } from '@/app/dashboard/actions/termActions'
import { ShieldAlert, Check, FileText } from 'lucide-react'

type TermData = {
  id: string
  version: string
  content: string
}

export function TermAcceptanceModal({ activeTerm }: { activeTerm: TermData }) {
  const router = useRouter()
  const [hasRead, setHasRead] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    const container = containerRef.current
    if (!container) return

    // Tolerance of 6px to handle zooming/rounding differences in different screens
    const isAtBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - 6

    if (isAtBottom) {
      setHasRead(true)
    }
  }

  // Fallback check: if the content is small and doesn't require scrolling, enable acceptance immediately.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const hasScrollbar = container.scrollHeight > container.clientHeight
    if (!hasScrollbar) {
      setHasRead(true)
    }
  }, [activeTerm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasRead || !accepted || isPending) return

    setIsPending(true)
    setErrorMsg('')

    const res = await acceptTermAction(activeTerm.id)
    if (res.error) {
      setErrorMsg(res.error)
      setIsPending(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-card/95 border border-border/80 w-full max-w-3xl rounded-[2rem] shadow-2xl shadow-primary/10 overflow-hidden flex flex-col max-h-[90vh] transition-all transform scale-100 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border/40 flex items-center gap-4 bg-muted/30">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Termo de Confidencialidade
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground mt-0.5">
              Versão {activeTerm.version} • Requisito de Conformidade Legal (LGPD)
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-8 py-6 text-sm text-foreground/80 space-y-4 leading-relaxed scrollbar-thin select-none"
          style={{ maxHeight: '50vh' }}
        >
          {/* Render content - split by double newlines into paragraphs */}
          {activeTerm.content.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('# ')) {
              return <h1 key={index} className="text-2xl font-black text-foreground pt-4 border-b border-border/40 pb-2">{paragraph.replace('# ', '')}</h1>
            }
            if (paragraph.startsWith('## ')) {
              return <h2 key={index} className="text-xl font-black text-foreground pt-3">{paragraph.replace('## ', '')}</h2>
            }
            if (paragraph.startsWith('### ')) {
              return <h3 key={index} className="text-base font-bold text-foreground pt-2">{paragraph.replace('### ', '')}</h3>
            }
            if (paragraph.startsWith('* ')) {
              return (
                <ul key={index} className="list-disc pl-6 space-y-2 my-2 font-medium">
                  {paragraph.split('\n').map((li, lIdx) => (
                    <li key={lIdx}>{li.replace('* ', '')}</li>
                  ))}
                </ul>
              )
            }
            return <p key={index} className="font-medium text-foreground/80">{paragraph}</p>
          })}
        </div>

        {/* Action Panel */}
        <div className="p-8 border-t border-border/40 bg-muted/20 space-y-6">
          {errorMsg && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold px-4 py-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          {!hasRead && (
            <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2.5 rounded-xl uppercase tracking-wider animate-pulse">
              <FileText className="w-4 h-4" />
              Role o termo até o final para liberar o aceite
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <label className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer ${
              !hasRead 
                ? 'opacity-40 cursor-not-allowed border-border bg-background/50' 
                : accepted 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border/60 bg-card hover:bg-muted/40'
            }`}>
              <div className="relative flex items-center mt-0.5">
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={!hasRead}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-muted-foreground/40 transition-all checked:border-primary checked:bg-primary disabled:cursor-not-allowed"
                />
                <Check className="pointer-events-none absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 stroke-[3] text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs sm:text-sm font-semibold text-foreground/80 selection:bg-transparent">
                Li, compreendo e aceito integralmente os termos descritos acima. Declaro que estou ciente das minhas responsabilidades legais e profissionais quanto ao tratamento de dados pessoais sensíveis no SisTEA.
              </div>
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!hasRead || !accepted || isPending}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-[0.98] uppercase tracking-widest"
              >
                {isPending ? 'REGISTRANDO ACEITE...' : 'Confirmar Primeiro Acesso'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
