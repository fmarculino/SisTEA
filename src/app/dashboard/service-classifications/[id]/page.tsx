import { createClient } from '@/utils/supabase/server'
import { ServiceClassificationForm } from '../ServiceClassificationForm'
import { notFound } from 'next/navigation'

export default async function EditServiceClassificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('service_classifications')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Cadastro de Serviço de Classificação
        </h2>
      </div>
      <ServiceClassificationForm id={item.id} initialData={item} />
    </div>
  )
}
