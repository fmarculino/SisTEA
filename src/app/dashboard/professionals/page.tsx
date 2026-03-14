import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus } from 'lucide-react'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; specialty?: string; clinic?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Fetch filter options
  const [{ data: specialties }, { data: clinics }] = await Promise.all([
    supabase.from('specialties').select('id, name').order('name'),
    profile?.role === 'SMS_ADMIN' ? supabase.from('clinics').select('id, name').order('name') : Promise.resolve({ data: [] })
  ])

  let selectQuery = '*, professional_clinics(clinics(name)), professional_specialties(specialties(name))'
  
  // Conditionally use inner joins for filtering to only return professionals matching the criteria
  const shouldFilterClinic = profile?.role === 'CLINIC_USER' || queryParams.clinic
  const shouldFilterSpecialty = queryParams.specialty

  if (shouldFilterClinic && shouldFilterSpecialty) {
     selectQuery = '*, professional_clinics!inner(clinics(name), clinic_id), professional_specialties!inner(specialties(name), specialty_id)'
  } else if (shouldFilterClinic) {
     selectQuery = '*, professional_clinics!inner(clinics(name), clinic_id), professional_specialties(specialties(name))'
  } else if (shouldFilterSpecialty) {
     selectQuery = '*, professional_clinics(clinics(name)), professional_specialties!inner(specialties(name), specialty_id)'
  }

  let query = supabase
    .from('professionals')
    .select(selectQuery)

  if (profile?.role === 'CLINIC_USER' && profile.clinic_id) {
    query = query.eq('professional_clinics.clinic_id', profile.clinic_id)
  } else if (queryParams.clinic) {
    query = query.eq('professional_clinics.clinic_id', queryParams.clinic)
  }

  if (queryParams.specialty) {
    query = query.eq('professional_specialties.specialty_id', queryParams.specialty)
  }

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`name.ilike.%${queryParams.q}%,cns.ilike.%${queryParams.q}%,cpf.ilike.%${queryParams.q}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  const { data: professionals } = await query.order('name')

  const extraFilters = []
  if (specialties && specialties.length > 0) {
    extraFilters.push({
      paramName: 'specialty',
      placeholder: 'Todas Especialidades',
      options: specialties.map(s => ({ value: s.id, label: s.name }))
    })
  }
  
  if (profile?.role === 'SMS_ADMIN' && clinics && clinics.length > 0) {
    extraFilters.push({
      paramName: 'clinic',
      placeholder: 'Todas Clínicas',
      options: clinics.map(c => ({ value: c.id, label: c.name }))
    })
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Corpo <span className="text-primary tracking-tighter">Clínico</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gestão estratégica de profissionais, especialidades e alocações em clínicas credenciadas.
          </p>
        </div>
        <Link
          href="/dashboard/professionals/new"
          className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
          Novo Profissional
        </Link>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters 
          placeholder="Pesquisar por nome, CNS ou CPF..." 
          extraFilters={extraFilters}
        />
      </div>

      <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Profissional / Documentos
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Especialidade
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Clínica(s)
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
              {(professionals as any[])?.map((prof: any) => (
                <tr 
                  key={prof.id} 
                  className={`transition-colors group/row hover:bg-muted/30 ${!prof.active ? 'opacity-60 grayscale-[0.3]' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">
                        {prof.name}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-1.5 flex flex-col space-y-0.5 font-mono uppercase tracking-tight opacity-70">
                        {prof.cpf && <span>CPF: {prof.cpf}</span>}
                        {prof.cns && <span>CNS: {prof.cns}</span>}
                        {prof.document_type && <span>{prof.document_type}: {prof.document_number}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-6">
                    <div className="flex flex-wrap gap-1.5">
                      {/* @ts-ignore - many-to-many join */}
                      {prof.professional_specialties?.map((ps: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center rounded-xl bg-primary/5 px-2.5 py-1 text-[10px] font-black text-primary border border-primary/10 uppercase tracking-tighter">
                          {ps.specialties?.name}
                        </span>
                      )) || <span className="text-[10px] font-bold text-muted-foreground bg-muted p-1 px-2 rounded-lg opacity-40 uppercase tracking-widest">Nenhuma</span>}
                    </div>
                  </td>
                  <td className="px-3 py-6">
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {/* @ts-ignore - many-to-many join */}
                      {prof.professional_clinics?.map((pc: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[9px] font-bold text-muted-foreground border border-border uppercase tracking-tight">
                          {pc.clinics?.name}
                        </span>
                      )) || <span className="text-[10px] font-bold text-muted-foreground bg-muted p-1 px-2 rounded-lg opacity-40 uppercase tracking-widest">Nenhuma</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {prof.active ? (
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
                    <div className="flex items-center justify-end">
                      <Link 
                        href={`/dashboard/professionals/${prof.id}`} 
                        className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                        title="Editar Profissional"
                      >
                        <Edit2 className="h-4 w-4 stroke-[2.5]" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!professionals || (professionals as any[]).length === 0) && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhum profissional encontrado</h3>
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
