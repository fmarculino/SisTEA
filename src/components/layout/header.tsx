'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'

export function Header({ email, role }: { email: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-foreground">Painel</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-right">
          <p className="font-medium text-foreground">{email}</p>
          <p className="text-muted-foreground text-xs">{role === 'SMS_ADMIN' ? 'Admin SMS' : 'Usuário Clínica'}</p>
        </div>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
