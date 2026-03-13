'use client'

import { LogOut, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'

export function Header({ 
  email, 
  role, 
  onMenuClick 
}: { 
  email: string; 
  role: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate max-w-[120px] md:max-w-none">
          Painel
        </h1>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block text-sm text-right">
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
