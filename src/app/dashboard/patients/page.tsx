import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus, User, CheckCircle, XCircle } from 'lucide-react'

import { DataTableFilters } from '@/components/ui/DataTableFilters'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; clinic?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Fetch clinics for filter
  const { data: clinicsList } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('active', true)
    .order('name')

  let query = supabase
    .from('patients')
    .select('*, clinics(name)')

  // Apply Search Filter
  if (queryParams.q) {
    query = query.or(`name.ilike.%${queryParams.q}%,cns_patient.ilike.%${queryParams.q}%`)
  }

  // Apply Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('active', queryParams.status === 'true')
  }

  // Apply Clinic Filter
  if (queryParams.clinic && queryParams.clinic !== 'all') {
    query = query.eq('clinic_id', queryParams.clinic)
  }

  const { data: patients } = await query.order('name')

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Pacientes <span className="text-primary tracking-tighter">Atendidos</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerenciamento centralizado de prontuários, documentos e histórico de atendimentos dos pacientes.
          </p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
          Novo Paciente
        </Link>
      </div>

      <div className="bg-card/50 backdrop-blur-sm border border-border/40 p-6 rounded-3xl shadow-sm">
        <DataTableFilters 
          placeholder="Pesquisar por nome ou CNS..." 
          extraFilters={[
            {
              paramName: 'clinic',
              placeholder: 'Todas as Clínicas',
              options: (clinicsList || []).map(c => ({ value: c.id, label: c.name }))
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
                  Paciente / Responsável
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Nascimento
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Clínica de Vínculo
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
              {patients?.map((patient) => (
                <tr 
                  key={patient.id} 
                  className={`transition-colors group/row hover:bg-muted/30 ${!patient.active ? 'opacity-60 grayscale-[0.3]' : ''}`}
                >
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mr-4 group-hover/row:scale-110 transition-transform">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">
                          {patient.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                          Mãe: {patient.mother_name || '-'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="text-sm font-medium text-muted-foreground">
                      {new Date(patient.birth_date).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="inline-flex items-center text-xs font-bold text-foreground/70 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border/50">
                      {/* @ts-ignore */}
                      {patient.clinics?.name || 'Sem clínica'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {patient.active ? (
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
                        href={`/dashboard/patients/${patient.id}`} 
                        className="p-2.5 rounded-xl text-primary bg-primary/5 hover:bg-primary/20 transition-all border border-primary/10 shadow-sm"
                        title="Ver prontuário"
                      >
                        <Edit2 className="h-4 w-4 stroke-[2.5]" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!patients || patients.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhum paciente encontrado</h3>
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

