import { login } from './actions'
import { Activity } from 'lucide-react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl shadow-lg border border-border">
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            SisTEA
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sistema de Controle e Auditoria SMS
          </p>
        </div>

        <form className="mt-8 space-y-6" action={login}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-t-md border-0 py-2.5 px-3 text-foreground ring-1 ring-inset ring-input placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-background"
                placeholder="E-mail"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-b-md border-0 py-2.5 px-3 text-foreground ring-1 ring-inset ring-input placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-background"
                placeholder="Senha"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary/90">
                Esqueceu a senha?
              </a>
            </div>
          </div>

          {searchParams?.error && (
            <div className="text-sm text-destructive text-center font-medium bg-destructive/10 p-2 rounded-md">
              {searchParams.error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
