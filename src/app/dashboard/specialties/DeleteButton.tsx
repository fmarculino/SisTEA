'use client'

import { useState } from 'react'
import { deleteSpecialtyAction } from './actions'

export function DeleteSpecialtyButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm('Deseja realmente excluir esta especialidade?')) {
      setIsDeleting(true)
      const result = await deleteSpecialtyAction(id)
      if (result && result.error) {
        alert(result.error)
        setIsDeleting(false)
      }
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-destructive hover:text-destructive/80 font-medium disabled:opacity-50"
    >
      {isDeleting ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
