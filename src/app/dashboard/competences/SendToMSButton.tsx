'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { sendToMSCompetenceAction } from './actions'
import { useRouter } from 'next/navigation'

export default function SendToMSButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSend = async () => {
    if (!window.confirm('Tem certeza? Isso aplicará o HARD LOCK. Ninguém mais poderá alterar ou reabrir essa competência pelo sistema.')) {
      return
    }

    setLoading(true)
    const { error } = await sendToMSCompetenceAction(id)
    if (error) {
      alert(error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-xl bg-indigo-500/10 px-4 py-2 text-xs font-black text-indigo-500 hover:bg-indigo-500/20 transition-colors uppercase tracking-widest disabled:opacity-50"
      title="Enviar ao MS (Hard Lock)"
    >
      <Send className="w-4 h-4 mr-2" />
      {loading ? 'Aguarde...' : 'Enviar MS'}
    </button>
  )
}
