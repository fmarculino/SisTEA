import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function SpecialtiesPage() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: specialties } = await supabase
    .from('specialties')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Especialidades / Funções
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as especialidades e seus respectivos códigos CBO.
          </p>
        </div>
        <Link
          href="/dashboard/specialties/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          Nova Especialidade
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
                CBO
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {specialties?.map((spec) => (
              <tr key={spec.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                  {spec.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">{spec.cbo}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Link href={`/dashboard/specialties/${spec.id}`} className="text-primary hover:text-primary/80 mr-4">
                    <Edit2 className="h-4 w-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!specialties || specialties.length === 0) && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma especialidade encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
