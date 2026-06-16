import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus, CheckCircle, XCircle, Settings2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ServiceClassificationActions } from './ServiceClassificationActions'
import { DataTableFilters } from '@/components/ui/DataTableFilters'
import { Pagination } from '@/components/ui/Pagination'

export default async function ServiceClassificationsPage({
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

  let query = supabase.from('service_classifications').select('*', { count: 'exact' })

  // Filtro de Busca Inteligente
  if (queryParams.q) {
    const cleanQ = queryParams.q.replace(/\D/g, '')
    // Busca pelo nome, valor formatado ou valor limpo
    query = query.or(`name.ilike.%${queryParams.q}%,service_code.ilike.%${queryParams.q}%,service_code.ilike.%${cleanQ}%,classification_code.ilike.%${queryParams.q}%,classification_code.ilike.%${cleanQ}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: classifications, count } = await query
    .order('service_code')
    .order('classification_code')
    .range(from, to)

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Serviço de / <span className="text-primary tracking-tighter">Classificação</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gestão do catálogo de serviços e classificações do DATASUS.
          </p>
        </div>
        {profile?.role === 'SMS_ADMIN' && (
          <Link
            href="/dashboard/service-classifications/new"
            className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
            Novo Cadastro
          </Link>
        )}
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters placeholder="Pesquisar por nome ou código..." />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Cód. Serviço
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Código
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Nome da Classificação
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Status
                </th>
                <th scope="col" className="relative py-5 pl-3 pr-8">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {classifications?.map((item) => (
                <tr 
                  key={item.id} 
                  className={`transition-colors group/row hover:bg-muted/30 ${!item.active ? 'opacity-60 grayscale-[0.3]' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <span className="text-sm font-mono font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                      {item.service_code}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="text-sm font-mono font-bold text-muted-foreground">
                      {item.classification_code}
                    </span>
                  </td>
                  <td className="px-3 py-6">
                    <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">
                      {item.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {item.active ? (
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
                          href={`/dashboard/service-classifications/${item.id}`} 
                          className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                        <ServiceClassificationActions id={item.id} active={item.active} name={item.name} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!classifications || classifications.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Settings2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhum cadastro encontrado</h3>
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
