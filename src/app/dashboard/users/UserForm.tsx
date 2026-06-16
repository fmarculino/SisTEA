'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema, type UserFormData } from './schema'
import { createUser, updateUser } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Shield, Lock, Building, ChevronDown, User } from 'lucide-react'

type ClinicOption = { id: string; name: string }

export function UserForm({ 
  initialData, 
  id, 
  clinics,
  userRole,
  userClinicId
}: { 
  initialData?: Partial<UserFormData>; 
  id?: string;
  clinics: ClinicOption[];
  userRole: string;
  userClinicId?: string | null;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: (initialData as any)?.name || '',
      email: initialData?.email || '',
      role: initialData?.role || 'GERENTE',
      clinic_id: initialData?.clinic_id || userClinicId || '',
      clinic_ids: (initialData as any)?.clinic_ids || (initialData?.clinic_id ? [initialData.clinic_id] : userClinicId ? [userClinicId] : []),
      default_clinic_id: (initialData as any)?.default_clinic_id || initialData?.clinic_id || userClinicId || '',
    },
  })

  const selectedRole = watch('role')
  const selectedClinicIds = watch('clinic_ids') || []
  const selectedDefaultClinicId = watch('default_clinic_id')

  const handleClinicChange = (clinicId: string, checked: boolean) => {
    let newClinicIds = [...selectedClinicIds]
    if (checked) {
      if (!newClinicIds.includes(clinicId)) {
        newClinicIds.push(clinicId)
      }
    } else {
      newClinicIds = newClinicIds.filter(id => id !== clinicId)
    }
    setValue('clinic_ids', newClinicIds, { shouldValidate: true })

    if (selectedDefaultClinicId === clinicId && !checked) {
      setValue('default_clinic_id', newClinicIds[0] || '', { shouldValidate: true })
    } else if (!selectedDefaultClinicId && newClinicIds.length > 0) {
      setValue('default_clinic_id', newClinicIds[0], { shouldValidate: true })
    }
  }

  const onSubmit = async (data: UserFormData) => {
    setIsPending(true)
    setErrorMsg('')

    // Set clinic_id for legacy compatibility
    data.clinic_id = data.default_clinic_id

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

      {/* Seção 1: Informações Pessoais */}
      <section>
        <SectionTitle icon={User} title="Informações Pessoais" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">Nome Completo *</label>
            <div className="relative">
              <input
                type="text"
                {...register('name')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
                placeholder="Nome Completo do Usuário"
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-destructive font-medium">{errors.name.message}</p>}
          </div>
        </div>
      </section>

      {/* Seção 2: Credenciais de Acesso */}
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
              {userRole === 'SMS_ADMIN' && (
                <optgroup label="Secretaria de Saúde (SMS)">
                  <option value="SMS_ADMIN">Administrador Geral</option>
                  <option value="REGULACAO">Regulação</option>
                  <option value="COORDENADOR">Coordenador</option>
                  <option value="OPERADOR">Operador</option>
                </optgroup>
              )}
              <optgroup label="Prestador Externo (Clínica)">
                <option value="GERENTE">Gerente da Clínica</option>
                <option value="RECEPCIONISTA">Recepcionista</option>
                <option value="FATURISTA">Faturista</option>
              </optgroup>
            </select>
            {errors.role && <p className="mt-1 text-xs text-destructive font-medium">{errors.role.message}</p>}
          </div>

          {['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(selectedRole) && (
            <div className="sm:col-span-2 space-y-3">
              <label className="block text-sm font-semibold text-foreground">Clínicas Vinculadas *</label>
              <div className="grid grid-cols-1 gap-3 border border-border p-4 rounded-2xl bg-muted/10 max-h-60 overflow-y-auto">
                {clinics.map((c) => {
                  const isChecked = selectedClinicIds.includes(c.id)
                  return (
                    <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isChecked 
                        ? 'bg-primary/5 border-primary/20 text-primary' 
                        : 'border-transparent text-foreground/80 hover:bg-muted/30'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={`clinic-${c.id}`}
                          checked={isChecked}
                          onChange={(e) => handleClinicChange(c.id, e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-input text-primary focus:ring-primary/20 transition-all cursor-pointer"
                        />
                        <label htmlFor={`clinic-${c.id}`} className="text-sm font-semibold cursor-pointer select-none">
                          {c.name}
                        </label>
                      </div>
                      {isChecked && (
                        <button
                          type="button"
                          onClick={() => setValue('default_clinic_id', c.id, { shouldValidate: true })}
                          className={`text-xs px-2.5 py-1 rounded-lg font-black transition-all ${
                            selectedDefaultClinicId === c.id
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-secondary text-foreground hover:bg-secondary/80'
                          }`}
                        >
                          {selectedDefaultClinicId === c.id ? 'Padrão ⭐' : 'Definir Padrão'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {errors.clinic_ids && <p className="mt-1 text-xs text-destructive font-medium">{errors.clinic_ids.message}</p>}
              {errors.default_clinic_id && <p className="mt-1 text-xs text-destructive font-medium">{errors.default_clinic_id.message}</p>}
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
