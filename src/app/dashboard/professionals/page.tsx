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
    .select('*, professional_clinics(clinics(name)), professional_specialties(specialties(name))')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight text-primary">
            Profissionais
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os profissionais da saúde credenciados no sistema SisTEA.
          </p>
        </div>
        <Link
          href="/dashboard/professionals/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all active:scale-95"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Novo Profissional
        </Link>
      </div>

      <div className="overflow-x-auto shadow ring-1 ring-border sm:rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6 uppercase tracking-wider">
                Profissional / Documentos
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground uppercase tracking-wider">
                Especialidade
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground uppercase tracking-wider">
                Clínica(s)
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
            {professionals?.map((prof) => (
              <tr key={prof.id} className={!prof.active ? 'opacity-50 grayscale-[0.5]' : ''}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                  <div className="font-bold">{prof.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-col space-y-0.5 font-mono">
                    {prof.cpf && <span>CPF: {prof.cpf}</span>}
                    {prof.cns && <span>CNS: {prof.cns}</span>}
                    {prof.document_type && <span>{prof.document_type}: {prof.document_number}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground italic">
                  <div className="flex flex-wrap gap-1">
                    {/* @ts-ignore - many-to-many join */}
                    {prof.professional_specialties?.map((ps: any, idx: number) => (
                      <span key={idx} className="block">
                        {ps.specialties?.name}
                        {idx < prof.professional_specialties.length - 1 ? ',' : ''}
                      </span>
                    )) || '-'}
                  </div>
                </td>
                <td className="px-3 py-4 text-sm text-muted-foreground max-w-xs transition-all hover:max-w-none hover:whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {/* @ts-ignore - many-to-many join */}
                    {prof.professional_clinics?.map((pc: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground border border-border">
                        {pc.clinics?.name}
                      </span>
                    )) || '-'}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${prof.active ? 'bg-green-500/10 text-green-500 ring-green-600/20 uppercase' : 'bg-muted text-muted-foreground ring-border uppercase'}`}>
                    {prof.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Link href={`/dashboard/professionals/${prof.id}`} className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors inline-block">
                    <Edit2 className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!professionals || professionals.length === 0) && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground uppercase tracking-widest font-bold">
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
