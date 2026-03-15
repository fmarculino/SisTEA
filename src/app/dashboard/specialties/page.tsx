import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus, CheckCircle, XCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { SpecialtyActions } from './SpecialtyActions'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function SpecialtiesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  let query = supabase.from('specialties').select('*')

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`name.ilike.%${queryParams.q}%,cbo.ilike.%${queryParams.q}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: specialties } = await query.order('name')

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Especialidades / <span className="text-primary tracking-tighter">Funções</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gestão do catálogo de ocupações e profissionais habilitados para o faturamento (CBO).
          </p>
        </div>
        <Link
          href="/dashboard/specialties/new"
          className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
          Nova Especialidade
        </Link>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters placeholder="Pesquisar por nome ou código CBO..." />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Código CBO
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Nome da Especialidade
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
              {specialties?.map((spec) => (
                <tr 
                  key={spec.id} 
                  className={`transition-colors group/row hover:bg-muted/30 ${!spec.active ? 'opacity-60 grayscale-[0.3]' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <span className="text-sm font-mono font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                      {spec.cbo}
                    </span>
                  </td>
                  <td className="px-3 py-6">
                    <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">
                      {spec.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {spec.active ? (
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
                    <div className="flex items-center justify-end space-x-3">
                      <Link 
                        href={`/dashboard/specialties/${spec.id}`} 
                        className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                        title="Editar Especialidade"
                      >
                        <Edit2 className="h-4 w-4 stroke-[2.5]" />
                      </Link>
                      <SpecialtyActions id={spec.id} active={spec.active} name={spec.name} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!specialties || specialties.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhuma especialidade encontrada</h3>
                        <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de pesquisa.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

