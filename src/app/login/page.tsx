import { login } from './actions'
import { Activity, Mail, Lock } from 'lucide-react'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-accent/20 rounded-full blur-[140px] animate-pulse delay-1000" />
      
      <div className="relative w-full max-w-[440px] animate-in">
        <div className="bento-card p-10 md:p-12">
          <div className="flex flex-col items-center">
            {/* Logo Section */}
            <div className="group relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary shadow-2xl shadow-primary/30 transition-all duration-500 hover:rotate-6 hover:scale-110">
              <Activity className="h-12 w-12 text-primary-foreground group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 rounded-[2rem] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="mt-8 text-center">
              <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase">
                Sis<span className="text-primary italic">TEA</span>
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="h-[1px] w-4 bg-primary/30" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-70">
                  Controle & Auditoria
                </p>
                <span className="h-[1px] w-4 bg-primary/30" />
              </div>
            </div>
          </div>

          <form className="mt-10 space-y-5" action={login}>
            <div className="space-y-4">
              <div className="group">
                <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 group-focus-within:text-primary transition-colors">
                  Identificação (E-mail)
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-4 px-5 text-sm text-foreground outline-none ring-primary/20 transition-all focus:border-primary focus:ring-4 placeholder:text-muted-foreground/50"
                    placeholder="exemplo@saude.gov.br"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="group">
                <label htmlFor="password" title="password" className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 group-focus-within:text-primary transition-colors">
                  Palavra-Chave (Senha)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-4 px-5 text-sm text-foreground outline-none ring-primary/20 transition-all focus:border-primary focus:ring-4 placeholder:text-muted-foreground/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-end px-1">
              <Link href="/forgot-password" title="password-recovery" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                Recuperar Acesso
              </Link>
            </div>

            {error && (
              <div className="text-[10px] text-destructive text-center font-black uppercase tracking-widest bg-destructive/5 py-3 px-4 rounded-xl border border-destructive/20 animate-bounce">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-primary py-4 px-4 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] hover:shadow-primary/30 active:scale-[0.98]"
            >
              <span className="relative z-10">Autenticar No Sistema</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            </button>
          </form>

          {/* Footer Identifier */}
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-[1px] bg-border" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em]">SMS Marabá</span>
              <div className="w-8 h-[1px] bg-border" />
            </div>
            <p className="max-w-[200px] text-[9px] font-medium text-muted-foreground leading-relaxed italic opacity-60">
              Plataforma protegida para gestão de saúde em Autismo e TDAH
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
