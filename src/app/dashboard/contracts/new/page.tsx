import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { ContractForm } from '../ContractForm'

export default async function NewContractPage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  
  const { data: clinics } = await supabase.from('clinics').select('id, name').order('name')
  const { data: procedures } = await supabase.from('procedures').select('id, code, description, valor_sus, valor_rp').order('description')

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Novo <span className="text-primary tracking-tighter">Contrato</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium">
          Cadastre um novo contrato e defina os procedimentos cobertos e seus valores.
        </p>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-8 rounded-[2rem] shadow-xl">
        <ContractForm clinics={clinics || []} procedures={procedures || []} />
      </div>
    </div>
  )
}
