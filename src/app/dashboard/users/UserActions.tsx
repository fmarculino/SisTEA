'use client'

import { useState } from 'react'
import { UserCheck, UserX } from 'lucide-react'
import { toggleUserStatus } from './actions'
import { useRouter } from 'next/navigation'

interface UserActionsProps {
  userId: string
  isActive: boolean
}

export default function UserActions({ userId, isActive }: UserActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggleStatus() {
    const action = isActive ? 'inativar' : 'ativar'
    if (!confirm(`Deseja realmente ${action} este usuário?`)) {
      return
    }

    setLoading(true)
    const result = await toggleUserStatus(userId, isActive)
    setLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-end space-x-2">
      <button
        onClick={handleToggleStatus}
        disabled={loading}
        title={isActive ? 'Inativar Usuário' : 'Ativar Usuário'}
        className={`p-2 rounded-full transition-colors ${
          isActive 
            ? 'text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/40' 
            : 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40'
        } disabled:opacity-50`}
      >
        {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
      </button>
    </div>
  )
}
