import { getUserProfile } from '@/lib/dal'
import { ProcedureForm } from '../ProcedureForm'
import { redirect } from 'next/navigation'

export default async function NewProcedurePage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Procedimento
        </h2>
      </div>
      <ProcedureForm />
    </div>
  )
}
