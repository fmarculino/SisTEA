'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteAttendanceAction } from './actions'
import { useRouter } from 'next/navigation'

export function DeleteAttendanceButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este atendimento?')) return

    setIsDeleting(true)
    const result = await deleteAttendanceAction(id)
    
    if (result && result.error) {
      alert(`Erro ao excluir: ${result.error}`)
      setIsDeleting(false)
    } else {
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-destructive hover:text-destructive/80 transition-colors p-1"
      title="Excluir Atendimento"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
