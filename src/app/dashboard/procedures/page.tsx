import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus, Scissors } from 'lucide-react'
import { redirect } from 'next/navigation'

import { DataTableFilters } from '@/components/ui/DataTableFilters'
import { Pagination } from '@/components/ui/Pagination'
import { formatCurrency } from '@/utils/format'
import { applyMask } from '@/utils/maskUtils'

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; specialty?: string; page?: string; limit?: string }
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

  // Fetch specialties for filter
  const { data: specialtiesList } = await supabase
    .from('specialties')
    .select('id, name')
    .eq('active', true)
    .order('name')

  let selectStr = `
    *,
    specialties:procedure_specialties(
      specialties(id, name)
    )
  `

  if (queryParams.specialty && queryParams.specialty !== 'all') {
    selectStr = `
      *,
      specialties:procedure_specialties!inner(
        specialties(id, name)
      )
    `
  }

  let query = supabase.from('procedures').select(selectStr, { count: 'exact' })

  // Filtro de Busca Inteligente
  if (queryParams.q) {
    const cleanQ = queryParams.q.replace(/\D/g, '')
    // Busca pela descrição, pelo valor formatado ou pelo valor limpo (sem pontos/traços)
    query = query.or(`name.ilike.%${queryParams.q}%,code.ilike.%${queryParams.q}%,code.ilike.%${cleanQ}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  // Apply Specialty Filter
  if (queryParams.specialty && queryParams.specialty !== 'all') {
    query = query.eq('procedure_specialties.specialty_id', queryParams.specialty)
  }

  const { data: procedures, count } = await query
    .order('name')
    .range(from, to)

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Catálogo de <span className="text-primary tracking-tighter">Procedimentos</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerencie o catálogo oficial de procedimentos, valores de repasse e vínculos com especialidades.
          </p>
        </div>
        {profile?.role === 'SMS_ADMIN' && (
          <Link
            href="/dashboard/procedures/new"
            className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
            Novo Procedimento
          </Link>
        )}
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters 
          searchType="procedure"
          placeholder="Pesquisar por nome ou código..." 
          extraFilters={[
            {
              paramName: 'specialty',
              placeholder: 'Todas Ocupações',
              options: (specialtiesList || []).map(s => ({ value: s.id, label: s.name }))
            }
          ]}
        />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Código / Nome
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Ocupações
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Valores (SUS / RP)
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Total
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
              {(procedures as any[])?.map((procedure) => (
                <tr 
                  key={procedure.id}
                  className={`transition-colors group/row hover:bg-muted/30 ${!procedure.active ? 'opacity-60 grayscale-[0.3]' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-1">
                        {procedure.code ? applyMask(procedure.code, 'procedure') : '-'}
                      </span>
                      <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors max-w-xs truncate">
                        {procedure.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-6">
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {/* @ts-ignore */}
                      {procedure.specialties?.map((s: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center rounded-lg bg-primary/5 px-2 py-0.5 text-[9px] font-black text-primary border border-primary/10 uppercase tracking-tighter">
                          {s.specialties?.name}
                        </span>
                      )) || <span className="text-[9px] text-muted-foreground italic">Nenhuma</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">SUS: <span className="text-foreground font-bold">{formatCurrency(procedure.valor_sus)}</span></span>
                      <span className="text-[10px] text-muted-foreground font-medium">RP: <span className="text-foreground font-bold">{formatCurrency(procedure.valor_rp)}</span></span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="text-sm font-black text-foreground">
                      {formatCurrency(procedure.valor_total || (procedure.valor_sus + procedure.valor_rp))}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {procedure.active ? (
                      <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest leading-none">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-muted px-3 py-1.5 text-[10px] font-black text-muted-foreground border border-border uppercase tracking-widest leading-none">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right text-sm font-medium">
                    {profile?.role === 'SMS_ADMIN' ? (
                      <div className="flex items-center justify-end">
                        <Link 
                          href={`/dashboard/procedures/${procedure.id}`} 
                          className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                          title="Editar Procedimento"
                        >
                          <Edit2 className="h-4 w-4 stroke-[2.5]" />
                        </Link>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!procedures || procedures.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Scissors className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhum procedimento encontrado</h3>
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
