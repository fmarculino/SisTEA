'use client'

import React, { useState } from 'react'
import { deleteTermVersionAction } from '@/app/dashboard/actions/termAdminActions'
import { CheckCircle, XCircle, Trash2, Calendar, Users } from 'lucide-react'

type TermItem = {
  id: string
  version: string
  content: string
  active: boolean
  created_at: string
  acceptCount: number
}

export function TermListClient({ initialTerms }: { initialTerms: TermItem[] }) {
  const [terms, setTerms] = useState<TermItem[]>(initialTerms)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta versão do termo?')) return

    setIsDeleting(id)
    setErrorMsg('')

    const res = await deleteTermVersionAction(id)
    if (res.error) {
      setErrorMsg(res.error)
      setIsDeleting(null)
    } else {
      setTerms(prev => prev.filter(t => t.id !== id))
      setIsDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 text-sm font-bold px-4 py-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      <div className="overflow-hidden bg-card border border-border/40 rounded-3xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-4 pl-8 pr-3 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Versão</th>
                <th className="px-3 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-3 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Criado em</th>
                <th className="px-3 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Aceites</th>
                <th className="px-3 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Prévia</th>
                <th className="relative py-4 pl-3 pr-8"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {terms.map((term) => (
                <tr key={term.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap py-5 pl-8 pr-3 font-bold text-foreground">
                    v{term.version}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5">
                    {term.active ? (
                      <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3 mr-1" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground border border-border uppercase tracking-wider">
                        <XCircle className="w-3 h-3 mr-1" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(term.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm font-bold text-foreground/90">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      {term.acceptCount}
                    </span>
                  </td>
                  <td className="px-3 py-5 text-xs text-muted-foreground font-medium max-w-xs truncate">
                    {term.content.slice(0, 100)}...
                  </td>
                  <td className="whitespace-nowrap py-5 pl-3 pr-8 text-right">
                    {term.acceptCount === 0 && (
                      <button
                        onClick={() => handleDelete(term.id)}
                        disabled={isDeleting === term.id}
                        className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20 disabled:opacity-50"
                        title="Excluir Versão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm font-medium text-muted-foreground">
                    Nenhuma versão de termo cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
