import { createClient } from '@/utils/supabase/server'
import { SpecialtyForm } from '../SpecialtyForm'
import { notFound } from 'next/navigation'

export default async function EditSpecialtyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: specialty } = await supabase
    .from('specialties')
    .select('*')
    .eq('id', id)
    .single()

  if (!specialty) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Especialidade
        </h2>
      </div>
      <SpecialtyForm id={specialty.id} initialData={specialty} />
    </div>
  )
}
