'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema, type UserFormData } from './schema'
import { createUser, updateUser } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Shield, Lock, Building, ChevronDown } from 'lucide-react'

type ClinicOption = { id: string; name: string }

export function UserForm({ 
  initialData, 
  id, 
  clinics,
  userRole
}: { 
  initialData?: Partial<UserFormData>; 
  id?: string;
  clinics: ClinicOption[];
  userRole: string;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: initialData?.email || '',
      role: initialData?.role || 'CLINIC_USER',
      clinic_id: initialData?.clinic_id || '',
    },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: UserFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updateUser(id, data)
    } else {
      result = await createUser(data)
    }

    if (result && result.error) {
      setErrorMsg(result.error)
      setIsPending(false)
    } else {
      router.push('/dashboard/users')
      router.refresh()
    }
  }

  const SectionTitle = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center space-x-2 text-primary font-bold border-b border-primary/20 pb-2 mb-4">
      <Icon className="w-5 h-5" />
      <span className="uppercase text-xs tracking-wider">{title}</span>
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl bg-card text-card-foreground p-8 rounded-xl shadow-xl border border-border">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm mb-4 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
          {errorMsg}
        </div>
      )}

      {/* Seção 1: Credenciais */}
      <section>
        <SectionTitle icon={Mail} title="Credenciais de Acesso" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">E-mail *</label>
            <div className="relative">
              <input
                type="email"
                {...register('email')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
                placeholder="usuario@exemplo.com"
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-destructive font-medium">{errors.email.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">
              {id ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha Temporária *'}
            </label>
            <div className="relative">
              <input
                type="password"
                {...register('password')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
                placeholder={id ? "Digite para alterar" : "Mínimo 6 caracteres"}
              />
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive font-medium">{errors.password.message}</p>}
          </div>
        </div>
      </section>

      {/* Seção 2: Perfil e Permissões */}
      <section>
        <SectionTitle icon={Shield} title="Perfil e Permissões" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Papel no Sistema *</label>
            <select
              {...register('role')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border appearance-none"
            >
              <option value="CLINIC_USER">Usuário de Clínica</option>
              {userRole === 'SMS_ADMIN' && <option value="SMS_ADMIN">Administrador SMS</option>}
            </select>
            {errors.role && <p className="mt-1 text-xs text-destructive font-medium">{errors.role.message}</p>}
          </div>

          {selectedRole === 'CLINIC_USER' && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Clínica Vinculada *</label>
              <select
                {...register('clinic_id')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              >
                <option value="">Selecione a clínica...</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.clinic_id && <p className="mt-1 text-xs text-destructive font-medium">{errors.clinic_id.message}</p>}
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end space-x-4 border-t border-border pt-6 mt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-input bg-background px-6 py-2.5 text-sm font-bold text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
        >
          CANCELAR
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center rounded-lg border border-transparent bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95"
        >
          {isPending ? 'SALVANDO...' : id ? 'ATUALIZAR USUÁRIO' : 'CRIAR USUÁRIO'}
        </button>
      </div>
    </form>
  )
}
