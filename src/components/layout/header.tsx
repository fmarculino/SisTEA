'use client'

import { LogOut, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'

export function Header({
  email,
  role,
  clinicName,
  onMenuClick
}: {
  email: string;
  role: string;
  clinicName?: string;
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
    <header className="sticky top-0 z-30 flex h-24 shrink-0 items-center justify-between border-b border-border/10 bg-background/50 backdrop-blur-2xl px-6 md:px-12">
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuClick}
          className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-all lg:hidden border border-border/20 shadow-sm"
        >
          <Menu className="h-6 w-6 stroke-[2.5]" />
        </button>
        <div className="hidden sm:flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tighter uppercase">
            Visão <span className="text-primary italic">Geral</span>
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50 mt-1">SMS-Secretaria Municipal de Saúde - Marabá</p>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-8">
        <div className="hidden md:flex flex-col text-right">
          <p className="font-black text-xs text-foreground uppercase tracking-widest leading-none mb-1.5">{email}</p>
          <div className="flex flex-col items-end">
            <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] border border-primary/20">
              {role === 'SMS_ADMIN' ? 'Controlador Geral' : 'Gestor de Clínica'}
            </span>
            {clinicName && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-70">
                {clinicName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-muted/40 backdrop-blur-md rounded-2xl border border-border/30 shadow-sm">
          <ThemeToggle />
          <div className="w-[1px] h-6 bg-border/40 mx-1" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-rose-500 rounded-xl transition-all duration-300 group shadow-sm"
            title="Encerrar Sessão"
          >
            <LogOut className="h-4 w-4 stroke-[2.5] group-hover:rotate-12 transition-transform" />
            <span className="hidden lg:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}
