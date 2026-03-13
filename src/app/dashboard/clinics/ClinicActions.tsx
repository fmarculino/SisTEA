'use client'

import { useState } from 'react'
import { toggleClinicStatus } from './actions'
import { Power } from 'lucide-react'

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

  const handleToggle = async () => {
    if (isPending) return
    setIsPending(true)
    await toggleClinicStatus(id, active)
    setIsPending(false)
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
    </div>
  )
}
