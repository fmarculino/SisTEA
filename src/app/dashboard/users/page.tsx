import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import Link from 'next/link'
import { Edit2, Shield, Building, UserPlus } from 'lucide-react'
import { redirect } from 'next/navigation'
import UserActions from './UserActions'

export default async function UsersPage() {
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select('*, clinics(name)')
    .order('email')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Gestão de Usuários
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administre os usuários e permissões de acesso ao sistema.
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all"
        >
          <UserPlus className="-ml-0.5 mr-2 h-5 w-5" aria-hidden="true" />
          Novo Usuário
        </Link>
      </div>

      <div className="overflow-hidden shadow-lg ring-1 ring-border sm:rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-4 pl-6 pr-3 text-left text-sm font-semibold text-foreground">
                  E-mail
                </th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-semibold text-foreground">
                  Perfil
                </th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-semibold text-foreground">
                  Status
                </th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-semibold text-foreground">
                  Clínica
                </th>
                <th scope="col" className="px-3 py-4 text-left text-sm font-semibold text-foreground">
                  Data de Criação
                </th>
                <th scope="col" className="relative py-4 pl-3 pr-6 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {users?.map((user) => (
                <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${!user.active ? 'opacity-60 bg-muted/10' : ''}`}>
                  <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-foreground">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      user.role === 'SMS_ADMIN' 
                        ? 'bg-purple-500/10 text-purple-700 border-purple-200 dark:border-purple-900' 
                        : 'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-900'
                    }`}>
                      <Shield className="mr-1 h-3 w-3" />
                      {user.role === 'SMS_ADMIN' ? 'Admin SMS' : 'Usuário Clínica'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      user.active 
                        ? 'bg-green-500/10 text-green-700 border-green-200 dark:border-green-900' 
                        : 'bg-red-500/10 text-red-700 border-red-200 dark:border-red-900'
                    }`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {user.role === 'CLINIC_USER' ? (
                      <div className="flex items-center">
                        <Building className="mr-1.5 h-4 w-4 text-muted-foreground/60" />
                        {/* @ts-ignore */}
                        {user.clinics?.name || 'Não vinculada'}
                      </div>
                    ) : (
                      <span className="text-xs uppercase tracking-widest text-muted-foreground/40 italic">Global</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-1">
                      <Link href={`/dashboard/users/${user.id}/edit`} className="text-primary hover:text-primary/80 transition-colors p-2 hover:bg-primary/10 rounded-full">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <UserActions userId={user.id} isActive={user.active} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground italic">
                    Nenhum usuário cadastrado além de você.
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
