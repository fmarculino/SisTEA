import { ServiceClassificationForm } from '../ServiceClassificationForm'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function NewServiceClassificationPage() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Cadastro de Serviço de Classificação
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha as informações abaixo para cadastrar um novo serviço/classificação.
        </p>
      </div>
      <ServiceClassificationForm />
    </div>
  )
}
