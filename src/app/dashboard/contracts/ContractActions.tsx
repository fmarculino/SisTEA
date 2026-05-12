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

  // Por regras de auditoria v0.9.0, a exclusão física foi desativada.
  // Os contratos devem ser mantidos para histórico financeiro.
  return null;
}
