import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Pacientes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os pacientes atendidos pelo programa.
          </p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Novo Paciente
        </Link>
      </div>

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

      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/40">
            <thead>
              <tr className="bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-left">
                <th scope="col" className="py-4 pl-6 pr-3">Nome</th>
                <th scope="col" className="px-3 py-4">Mãe / Responsável</th>
                <th scope="col" className="px-3 py-4">Nascimento</th>
                <th scope="col" className="px-3 py-4">Clínica</th>
                <th scope="col" className="px-3 py-4">Status</th>
                <th scope="col" className="relative py-4 pl-3 pr-6">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 bg-card">
              {patients?.map((patient) => (
                <tr key={patient.id} className="group hover:bg-muted/20 transition-colors duration-200">
                  <td className="whitespace-nowrap py-5 pl-6 pr-3 text-sm font-semibold text-foreground">
                    {patient.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {patient.mother_name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground">
                    {new Date(patient.birth_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm text-muted-foreground">
                    {/* @ts-ignore - foreign key relationship */}
                    {patient.clinics?.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      patient.active 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {patient.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="relative whitespace-nowrap py-5 pl-3 pr-6 text-right text-sm font-medium">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Link 
                        href={`/dashboard/patients/${patient.id}`} 
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                        title="Editar Paciente"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!patients || patients.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground italic">
                    Nenhum paciente encontrado.
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
