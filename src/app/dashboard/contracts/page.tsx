import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit2, FileSignature, AlertCircle } from 'lucide-react'
import { ContractActions } from './ContractActions'
import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id,
      contract_number,
      valid_from,
      valid_to,
      valor_total,
      valor_saldo,
      clinic_id,
      active,
      clinic:clinics!inner(name),
      items:clinic_procedure_prices(id)
    `)
    .order('valid_from', { ascending: false })

  const uniqueContracts = contracts?.map(c => ({
    clinic_id: c.clinic_id,
    contract_number: c.contract_number,
    clinic_name: (c.clinic as any)?.name,
    valid_from: c.valid_from,
    valid_to: c.valid_to,
    valor_total: Number(c.valor_total || 0),
    valor_saldo: Number(c.valor_saldo || 0),
    active: c.active,
    items_count: c.items?.length || 0
  })) || []

  const filteredContracts = uniqueContracts.filter(c => {
    if (!queryParams.q) return true
    const q = queryParams.q.toLowerCase()
    return (
      c.clinic_name?.toLowerCase().includes(q) ||
      c.contract_number?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Tabela de <span className="text-primary tracking-tighter">Contratos</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerencie os contratos de prestação de serviços, tetos financeiros e saldos de competência.
          </p>
        </div>
        <Link
          href="/dashboard/contracts/new"
          className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
          Novo Contrato
        </Link>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters placeholder="Pesquisar por clínica ou número do contrato..." />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <table className="min-w-full divide-y divide-border/30">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Clínica
              </th>
              <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Contrato
              </th>
              <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Validade
              </th>
              <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Valor Global / Saldo
              </th>
              <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Procedimentos
              </th>
              <th scope="col" className="relative py-5 pl-3 pr-8">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {filteredContracts.map((contract) => (
              <tr key={`${contract.clinic_id}-${contract.contract_number}`} className="transition-colors group/row hover:bg-muted/30">
                <td className="whitespace-nowrap py-6 pl-8 pr-3">
                  <span className="text-sm font-bold text-foreground">
                    {contract.clinic_name}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-6">
                  <span className="inline-flex items-center rounded-xl bg-primary/10 px-3 py-1 text-xs font-black text-primary border border-primary/20 uppercase tracking-widest">
                    <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                    {contract.contract_number}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Início: {new Date(contract.valid_from + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Fim: {contract.valid_to ? new Date(contract.valid_to + 'T12:00:00').toLocaleDateString('pt-BR') : 'Vigente'}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_total)}
                    </span>
                    <span className="text-xs font-black text-emerald-500 mt-1 uppercase tracking-wider">
                      Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.valor_saldo)}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-6 text-sm text-muted-foreground font-medium">
                  {contract.items_count} itens cadastrados
                </td>
                <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-3">
                    <Link 
                      href={`/dashboard/contracts/${Buffer.from(`${contract.clinic_id}_${contract.contract_number}`).toString('base64url')}/edit`} 
                      className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                      title="Editar Contrato"
                    >
                      <Edit2 className="h-4 w-4 stroke-[2.5]" />
                    </Link>
                    <ContractActions clinicId={contract.clinic_id} contractNumber={contract.contract_number} />
                  </div>
                </td>
              </tr>
            ))}
            {filteredContracts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <FileSignature className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Nenhum contrato encontrado</h3>
                      <p className="text-sm text-muted-foreground">Cadastre contratos de preço para visualizá-los aqui.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
