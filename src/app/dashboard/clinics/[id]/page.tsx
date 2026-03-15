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
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Editar <span className="text-primary tracking-tighter">Clínica</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Atualize os dados cadastrais, informações de contato e configurações de acesso da unidade.
        </p>
      </div>
      <ClinicForm id={clinic.id} initialData={clinic} />
    </div>
  )
}
