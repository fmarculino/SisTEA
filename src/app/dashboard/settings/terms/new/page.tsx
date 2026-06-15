import { getUserProfile, getActiveTerm } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { TermNewForm } from './TermNewForm'

export default async function NewTermPage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const latestTerm = await getActiveTerm()

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Novo <span className="text-primary tracking-tighter">Termo</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Crie uma nova versão do termo de confidencialidade e regras de proteção de dados.
        </p>
      </div>

      <TermNewForm initialContent={latestTerm?.content || ''} />
    </div>
  )
}

