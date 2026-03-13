import { createClient } from '@/utils/supabase/server'
import { SpecialtyForm } from '../../SpecialtyForm'
import { notFound } from 'next/navigation'

export default async function EditSpecialtyPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: specialty, error } = await supabase
    .from('specialties')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !specialty) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Editar Especialidade</h1>
      </div>
      <SpecialtyForm initialData={specialty} id={id} />
    </div>
  )
}
