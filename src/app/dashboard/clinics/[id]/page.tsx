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

  // Buscar clínicas que podem ser matrizes (que não são filiais)
  const { data: matrixClinics } = await supabase
    .from('clinics')
    .select('id, name, cnes')
    .is('parent_clinic_id', null)
    .eq('active', true)
    .order('name')

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Editar <span className="text-primary tracking-tighter">Clínica</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Atualize os dados cadastrais, informações de contato e configurações de acesso da unidade.
        </p>
      </div>
      <ClinicForm id={clinic.id} initialData={clinic} matrixClinics={matrixClinics || []} />
    </div>
  )
}

