'use client'

import { useState } from 'react'
import { toggleCidStatus } from './actions'
import { Power } from 'lucide-react'

export function CidActions({ 
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
    try {
      await toggleCidStatus(id, active)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center justify-end space-x-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`p-2.5 rounded-xl transition-all border ${
          active 
            ? 'text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10' 
            : 'text-muted-foreground bg-muted hover:bg-muted-foreground/10 border-border'
        }`}
        title={active ? 'Inativar' : 'Ativar'}
      >
        <Power className={`h-4 w-4 stroke-[2.5] ${isPending ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  )
}
