import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { ContractForm } from '../../ContractForm'

export default async function EditContractPage({
  params
}: {
  params: { id: string }
}) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const { id } = await params
  
  // Decodifica a string em base64url para obter "clinic_id_contract_number"
  const decodedId = Buffer.from(id, 'base64url').toString('utf-8')
  const [clinic_id, ...contract_number_parts] = decodedId.split('_')
  const contract_number = contract_number_parts.join('_')

  const supabase = await createClient()
  
  const { data: items } = await supabase
    .from('clinic_procedure_prices')
    .select('*')
    .eq('clinic_id', clinic_id)
    .eq('contract_number', contract_number)
  
  if (!items || items.length === 0) {
    redirect('/dashboard/contracts')
  }

  const initialData = {
    clinic_id: items[0].clinic_id,
    contract_number: items[0].contract_number,
    valid_from: items[0].valid_from,
    valid_to: items[0].valid_to,
    items: items
  }

  const { data: clinics } = await supabase.from('clinics').select('id, name').order('name')
  const { data: procedures } = await supabase.from('procedures').select('id, code, description, valor_sus, valor_rp').order('description')

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Editar <span className="text-primary tracking-tighter">Contrato</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium">
          Atualize os procedimentos e os valores cobertos por este contrato.
        </p>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-8 rounded-[2rem] shadow-xl">
        <ContractForm 
          initialData={initialData}
          clinics={clinics || []} 
          procedures={procedures || []} 
        />
      </div>
    </div>
  )
}
