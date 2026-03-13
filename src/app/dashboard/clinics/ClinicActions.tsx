'use client'

import { useState } from 'react'
import { toggleClinicStatus, deleteClinicAction } from './actions'
import { Power, Trash2, AlertCircle } from 'lucide-react'

export function ClinicActions({ 
  id, 
  active, 
  name 
}: { 
  id: string; 
  active: boolean; 
  name: string;
}) {
  const [isPending, setIsPending] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const handleToggle = async () => {
    if (isPending) return
    setIsPending(true)
    await toggleClinicStatus(id, active)
    setIsPending(false)
  }

  const handleDelete = async () => {
    if (isPending) return
    setIsPending(true)
    const result = await deleteClinicAction(id)
    if (result && 'error' in result && result.error) {
       alert(result.error)
    }
    setIsPending(false)
    setShowConfirmDelete(false)
  }

  return (
    <div className="flex items-center justify-end space-x-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`p-1.5 rounded-full transition-colors ${
          active 
            ? 'text-green-500 hover:bg-green-500/10' 
            : 'text-muted-foreground hover:bg-muted-foreground/10'
        }`}
        title={active ? 'Inativar Clínica' : 'Ativar Clínica'}
      >
        <Power className={`h-4 w-4 ${isPending ? 'animate-pulse' : ''}`} />
      </button>

      <button
        onClick={() => setShowConfirmDelete(true)}
        className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Excluir Clínica"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md p-6 rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-destructive mb-4">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold uppercase tracking-tight">Excluir Clínica</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Tem certeza que deseja excluir a clínica <strong>{name}</strong>? Esta ação não pode ser desfeita e pode afetar usuários e prontuários vinculados.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all"
              >
                CANCELAR
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all font-bold disabled:opacity-50"
              >
                {isPending ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
