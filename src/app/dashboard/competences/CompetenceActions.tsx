'use client'

import { useTransition } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { closeCompetenceAction, reopenCompetenceAction } from './actions'

export function CloseCompetenceButton({ clinicId, month, year, isAdminView }: { clinicId: string, month: number, year: number, isAdminView?: boolean }) {
  const [isPending, startTransition] = useTransition()

  const handleClose = () => {
    if (confirm(`Tem certeza que deseja encerrar a competência ${month}/${year}? Nenhuma nova alteração poderá ser feita nos atendimentos deste mês.`)) {
      startTransition(async () => {
        const result = await closeCompetenceAction(clinicId, month, year)
        if (result?.error) {
          alert(result.error)
        }
      })
    }
  }

  return (
    <button 
      onClick={handleClose}
      disabled={isPending}
      className={
        isAdminView
          ? "p-2.5 rounded-xl text-red-500 bg-red-500/5 hover:bg-red-500/20 transition-all border border-red-500/10 shadow-sm disabled:opacity-50"
          : "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
      }
      title="Encerrar Competência"
    >
      <Lock className="h-4 w-4 stroke-[2.5]" />
      {!isAdminView && (isPending ? 'Encerrando...' : 'Encerrar Competência')}
    </button>
  )
}

export function ReopenCompetenceButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  const handleReopen = () => {
    if (confirm('Tem certeza que deseja reabrir esta competência? A clínica poderá fazer alterações no faturamento deste mês.')) {
      startTransition(async () => {
        const result = await reopenCompetenceAction(id)
        if (result?.error) {
          alert(result.error)
        }
      })
    }
  }

  return (
    <button 
      onClick={handleReopen}
      disabled={isPending}
      className="p-2.5 rounded-xl text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/20 transition-all border border-emerald-500/10 shadow-sm disabled:opacity-50"
      title="Reabrir Competência"
    >
      <Unlock className="h-4 w-4 stroke-[2.5]" />
    </button>
  )
}
