import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { ProcedureForm } from '../ProcedureForm'
import { notFound, redirect } from 'next/navigation'

export default async function EditProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') redirect('/dashboard')

  const supabase = await createClient()
  const { id } = await params
  
  const { data: procedure } = await supabase.from('procedures').select('*').eq('id', id).single()
  if (!procedure) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Procedimento
        </h2>
      </div>
      <ProcedureForm 
        id={procedure.id}
        initialData={procedure}
      />
    </div>
  )
}
