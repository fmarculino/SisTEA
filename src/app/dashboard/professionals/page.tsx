import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus } from 'lucide-react'

export default async function ProfessionalsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  // Se SMS_ADMIN, lista tudo; Se CLINIC_USER, rls cuida disso, mas chamamos normal.
  const { data: professionals } = await supabase
    .from('professionals')
    .select('*, professional_clinics(clinics(name)), specialties(name)')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Profissionais
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os profissionais da saúde credenciados.
          </p>
        </div>
        <Link
          href="/dashboard/professionals/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Novo Profissional
        </Link>
      </div>

      <div className="overflow-hidden shadow ring-1 ring-border sm:rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                Nome
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Especialidade
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Clínica
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
            {professionals?.map((prof) => (
              <tr key={prof.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                  {prof.name}
                  <div className="text-muted-foreground font-normal">{prof.document_type} {prof.document_number}</div>
                  {prof.cns && <div className="text-[10px] text-muted-foreground font-mono">CNS: {prof.cns}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {/* @ts-ignore */}
                  {prof.specialties?.name || prof.specialty || '-'}
                </td>
                <td className="px-3 py-4 text-sm text-muted-foreground max-w-xs truncate">
                  {/* @ts-ignore - many-to-many join */}
                  {prof.professional_clinics?.map((pc: any) => pc.clinics?.name).join(', ') || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${prof.active ? 'bg-green-500/10 text-green-500 ring-green-500/20' : 'bg-destructive/10 text-destructive ring-destructive/20'}`}>
                    {prof.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Link href={`/dashboard/professionals/${prof.id}`} className="text-primary hover:text-primary/80 mr-4">
                    <Edit2 className="h-4 w-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!professionals || professionals.length === 0) && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum profissional encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
