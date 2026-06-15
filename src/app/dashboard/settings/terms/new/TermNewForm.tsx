'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTermVersionAction } from '@/app/dashboard/actions/termAdminActions'
import { ScrollText, Check, AlertTriangle, Eye } from 'lucide-react'

export function TermNewForm() {
  const router = useRouter()
  const [version, setVersion] = useState('')
  const [content, setContent] = useState('')
  const [active, setActive] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!version || !content) {
      setErrorMsg('Preencha a versão e o conteúdo do termo.')
      return
    }

    setIsPending(true)
    setErrorMsg('')

    const res = await createTermVersionAction(version, content, active)
    if (res.error) {
      setErrorMsg(res.error)
      setIsPending(false)
    } else {
      router.push('/dashboard/settings/terms')
      router.refresh()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl">
      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border/40 space-y-6">
        <div className="flex items-center space-x-2 text-primary font-bold border-b border-primary/20 pb-3 mb-2">
          <ScrollText className="w-5 h-5" />
          <span className="uppercase text-xs tracking-wider">Nova Versão do Termo</span>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 text-sm font-bold px-4 py-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Versão *</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Ex: 1.1 ou 2.0"
            className="block w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Conteúdo do Termo (Markdown) *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={15}
            placeholder="# TÍTULO DO TERMO&#10;&#10;## Seção 1...&#10;&#10;Use quebras de linha duplas para separar parágrafos."
            className="block w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono scrollbar-thin"
            required
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/20 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="mt-1 h-5 w-5 rounded-lg border-2 border-muted-foreground/40 text-primary focus:ring-primary"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Definir como Versão Ativa</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Ao ativar, a versão anterior será desativada. **Todos os usuários** precisarão ler e aceitar esta nova versão no próximo acesso.
              </span>
            </div>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 border-t border-border/40 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-input bg-background px-6 py-2.5 text-sm font-bold text-muted-foreground shadow-sm hover:bg-accent transition-all active:scale-95 uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="lg:hidden rounded-xl border border-border bg-background px-6 py-2.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent transition-all active:scale-95 uppercase tracking-wider inline-flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Ocultar Prévia' : 'Ver Prévia'}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex justify-center items-center rounded-xl bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-wider"
          >
            {isPending ? 'Salvando...' : 'Salvar Versão'}
          </button>
        </div>
      </form>

      {/* Preview Container (Visible by default on LG screens, toggled on smaller screens) */}
      <div className={`bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border/40 flex flex-col ${
        showPreview ? 'block' : 'hidden lg:flex'
      }`}>
        <div className="flex items-center space-x-2 text-muted-foreground font-bold border-b border-border/40 pb-3 mb-4">
          <Eye className="w-5 h-5" />
          <span className="uppercase text-xs tracking-wider">Pré-visualização do Layout</span>
        </div>

        {active && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Esta versão irá bloquear o sistema para re-aceite global imediato.
          </div>
        )}

        <div className="flex-1 border border-border/40 rounded-2xl bg-muted/10 p-6 overflow-y-auto max-h-[50vh] lg:max-h-[60vh] text-sm text-foreground/80 leading-relaxed space-y-4">
          {content ? (
            content.split('\n\n').map((paragraph, index) => {
              if (paragraph.startsWith('# ')) {
                return <h1 key={index} className="text-xl font-black text-foreground pt-3 border-b border-border/40 pb-1.5">{paragraph.replace('# ', '')}</h1>
              }
              if (paragraph.startsWith('## ')) {
                return <h2 key={index} className="text-lg font-black text-foreground pt-2.5">{paragraph.replace('## ', '')}</h2>
              }
              if (paragraph.startsWith('### ')) {
                return <h3 key={index} className="text-sm font-bold text-foreground pt-1.5">{paragraph.replace('### ', '')}</h3>
              }
              if (paragraph.startsWith('* ')) {
                return (
                  <ul key={index} className="list-disc pl-5 space-y-1.5 my-1.5 font-medium">
                    {paragraph.split('\n').map((li, lIdx) => (
                      <li key={lIdx}>{li.replace('* ', '')}</li>
                    ))}
                  </ul>
                )
              }
              return <p key={index} className="font-medium">{paragraph}</p>
            })
          ) : (
            <p className="text-muted-foreground italic text-center py-10">O conteúdo do termo aparecerá formatado aqui à medida que você digitar.</p>
          )}
        </div>
      </div>
    </div>
  )
}
