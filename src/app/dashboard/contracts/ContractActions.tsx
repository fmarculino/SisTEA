'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteContractBulkAction } from './actions'

export function ContractActions({ clinicId, contractNumber }: { clinicId: string, contractNumber: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja excluir este contrato inteiro? Todos os preços vinculados a ele serão removidos. Atendimentos já salvos com este valor não serão alterados.')) {
      startTransition(async () => {
        const result = await deleteContractBulkAction(clinicId, contractNumber)
        if (result?.error) {
          alert(result.error)
        }
      })
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isPending}
      className="p-2.5 rounded-xl text-red-500 bg-red-500/5 hover:bg-red-500/20 transition-all border border-red-500/10 shadow-sm disabled:opacity-50"
      title="Excluir Contrato"
    >
      <Trash2 className="h-4 w-4 stroke-[2.5]" />
    </button>
  )
}
