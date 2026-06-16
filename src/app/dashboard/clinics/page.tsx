import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Edit2, Plus, CheckCircle, XCircle, Building2, GitBranch } from 'lucide-react'
import { ClinicActions } from './ClinicActions'

import { DataTableFilters } from '@/components/ui/DataTableFilters'
import { Pagination } from '@/components/ui/Pagination'
import { applyMask } from '@/utils/maskUtils'

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; limit?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const GLOBAL_ROLES = ['SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR']
  if (!profile || !GLOBAL_ROLES.includes(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  
  const page = Number(queryParams.page) || 1
  const limit = Number(queryParams.limit) || 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase.from('clinics').select('*, parent_clinic:clinics!parent_clinic_id(name)', { count: 'exact' })

  // Filtro de Busca Inteligente
  if (queryParams.q) {
    const cleanQ = queryParams.q.replace(/\D/g, '')
    // Busca pelo nome, pelo valor formatado ou pelo valor limpo (sem pontos/traços)
    query = query.or(`name.ilike.%${queryParams.q}%,cnpj.ilike.%${queryParams.q}%,cnpj.ilike.%${cleanQ}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: clinics, count } = await query
    .order('parent_clinic_id', { ascending: true, nullsFirst: true })
    .order('name')
    .range(from, to)

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Clínicas <span className="text-primary tracking-tighter">Credenciadas</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Painel administrativo para gestão de clínicas parceiras e regulação de credenciamentos.
          </p>
        </div>
        {profile?.role === 'SMS_ADMIN' && (
          <Link
            href="/dashboard/clinics/new"
            className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
            Nova Clínica
          </Link>
        )}
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters 
          searchType="cnpj"
          placeholder="Pesquisar por nome ou CNPJ..." 
        />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Nome / Razão Social
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  CNPJ / Identificação
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Tipo
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Status Operacional
                </th>
                <th scope="col" className="relative py-5 pl-3 pr-8">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {clinics?.map((clinic: any) => (
                <tr 
                  key={clinic.id} 
                  className={`transition-colors group/row hover:bg-muted/30 ${!clinic.active ? 'opacity-60 grayscale-[0.3]' : ''} ${clinic.parent_clinic_id ? 'bg-muted/5' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {clinic.parent_clinic_id && (
                          <span className="text-muted-foreground/40 text-sm">└</span>
                        )}
                        <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">
                          {clinic.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                        {clinic.parent_clinic_id 
                          ? `Filial de: ${(clinic.parent_clinic as any)?.name || 'Matriz'}`
                          : (clinic.corporate_name || 'Razão Social não informada')}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="text-sm font-black tracking-tight text-foreground">
                      {clinic.cnpj ? applyMask(clinic.cnpj, 'cnpj') : '-'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {clinic.parent_clinic_id ? (
                      <span className="inline-flex items-center rounded-xl bg-amber-500/10 px-3 py-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-widest leading-none">
                        <GitBranch className="w-3 h-3 mr-1.5 stroke-[2.5]" /> Filial
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-primary/10 px-3 py-1.5 text-[10px] font-black text-primary border border-primary/20 uppercase tracking-widest leading-none">
                        <Building2 className="w-3 h-3 mr-1.5 stroke-[2.5]" /> Matriz
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {clinic.active ? (
                      <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest leading-none">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-muted px-3 py-1.5 text-[10px] font-black text-muted-foreground border border-border uppercase tracking-widest leading-none">
                        <XCircle className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right text-sm font-medium">
                    {profile?.role === 'SMS_ADMIN' ? (
                      <div className="flex items-center justify-end space-x-3">
                        <Link 
                          href={`/dashboard/clinics/${clinic.id}`} 
                          className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                          title="Editar clínica"
                        >
                          <Edit2 className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                        <ClinicActions id={clinic.id} active={clinic.active} name={clinic.name} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!clinics || clinics.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhuma clínica encontrada</h3>
                        <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de pesquisa.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={count || 0} itemsPerPage={limit} currentPage={page} />
      </div>
    </div>
  )
}

