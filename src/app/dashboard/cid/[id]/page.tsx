import { createClient } from '@/utils/supabase/server'
import { CidForm } from '../CidForm'
import { notFound } from 'next/navigation'

export default async function EditCidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('cid')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Cadastro CID-10
        </h2>
      </div>
      <CidForm id={item.id} initialData={item} />
    </div>
  )
}
