import { createClient } from '@/utils/supabase/server'
import { ClinicForm } from '../ClinicForm'
import { notFound } from 'next/navigation'

export default async function EditClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: clinic } = await supabase.from('clinics').select('*').eq('id', id).single()

  if (!clinic) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Clínica
        </h2>
      </div>
      <ClinicForm id={clinic.id} intialData={clinic} />
    </div>
  )
}
