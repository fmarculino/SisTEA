import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard') // Somente admin acessa procedimentos
  }

  const supabase = await createClient()

  let query = supabase.from('procedures').select('*')

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`name.ilike.%${queryParams.q}%,code.ilike.%${queryParams.q}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: procedures } = await query.order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Procedimentos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie o catálogo de procedimentos e seus valores de repasse.
          </p>
        </div>
        <Link
          href="/dashboard/procedures/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Novo Procedimento
        </Link>
      </div>

      <DataTableFilters placeholder="Pesquisar por nome ou código..." />

      <div className="overflow-x-auto shadow ring-1 ring-border sm:rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                Código
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Nome
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Valor SUS
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Repasse
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Total
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {procedures?.map((procedure) => (
              <tr key={procedure.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                  {procedure.code}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {procedure.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(procedure.valor_sus)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(procedure.valor_rp)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(procedure.valor_total || (procedure.valor_sus + procedure.valor_rp))}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${procedure.active ? 'bg-green-500/10 text-green-700 dark:text-green-400 ring-green-600/20' : 'bg-destructive/10 text-destructive dark:text-destructive-foreground ring-destructive/20'}`}>
                    {procedure.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Link href={`/dashboard/procedures/${procedure.id}`} className="text-primary hover:text-primary/80 mr-4">
                    <Edit2 className="h-4 w-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!procedures || procedures.length === 0) && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum procedimento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
