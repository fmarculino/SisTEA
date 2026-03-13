import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Edit2, Plus, CheckCircle, XCircle } from 'lucide-react'
import { ClinicActions } from './ClinicActions'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  
  let query = supabase.from('clinics').select('*')

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`name.ilike.%${queryParams.q}%,cnpj.ilike.%${queryParams.q}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: clinics } = await query.order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight text-primary">
            Clínicas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as clínicas credenciadas no sistema.
          </p>
        </div>
        <Link
          href="/dashboard/clinics/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all active:scale-95"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Nova Clínica
        </Link>
      </div>

      <DataTableFilters placeholder="Pesquisar por nome ou CNPJ..." />

      <div className="overflow-x-auto shadow ring-1 ring-border sm:rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6 uppercase tracking-wider">
                Nome Fantasia
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground uppercase tracking-wider">
                CNPJ
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {clinics?.map((clinic) => (
              <tr key={clinic.id} className={!clinic.active ? 'opacity-50 grayscale-[0.5]' : ''}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                  {clinic.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground font-mono">{clinic.cnpj || '-'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  {clinic.active ? (
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-500 border border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" /> ATIVO
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground border border-border">
                      <XCircle className="w-3 h-3 mr-1" /> INATIVO
                    </span>
                  )}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex items-center justify-end space-x-2">
                    <Link href={`/dashboard/clinics/${clinic.id}`} className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    <ClinicActions id={clinic.id} active={clinic.active} name={clinic.name} />
                  </div>
                </td>
              </tr>
            ))}
            {(!clinics || clinics.length === 0) && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground uppercase tracking-widest font-bold">
                  Nenhuma clínica encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
