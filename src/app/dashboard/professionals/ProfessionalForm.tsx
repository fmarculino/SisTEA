'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { professionalSchema, type ProfessionalFormData } from './schema'
import { createProfessionalAction, updateProfessionalAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ClinicOption = { id: string; name: string }
type SpecialtyOption = { id: string; name: string; cbo: string }

export function ProfessionalForm({ 
  initialData, 
  id, 
  clinics, 
  specialties,
  userRole, 
  userClinicId 
}: { 
  initialData?: Partial<ProfessionalFormData>; 
  id?: string;
  clinics: ClinicOption[];
  specialties: SpecialtyOption[];
  userRole: string;
  userClinicId?: string | null;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: initialData?.name || '',
      document_type: initialData?.document_type || '',
      document_number: initialData?.document_number || '',
      specialty_id: initialData?.specialty_id || '',
      email: initialData?.email || '',
      active: initialData?.active ?? true,
      clinic_ids: initialData?.clinic_ids || (userClinicId ? [userClinicId] : []),
    },
  })

  const onSubmit = async (data: ProfessionalFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updateProfessionalAction(id, data)
    } else {
      result = await createProfessionalAction(data)
    }

    if (result && result.error) {
      setErrorMsg(result.error)
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card text-card-foreground p-6 rounded-lg shadow border">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Nome do Profissional *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Tipo Documento (CRP, CRM, etc)</label>
          <input
            type="text"
            {...register('document_type')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Número do Documento</label>
          <input
            type="text"
            {...register('document_number')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Especialidade / Função *</label>
          <select
            {...register('specialty_id')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          >
            <option value="">Selecione a especialidade...</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>{s.name} (CBO: {s.cbo})</option>
            ))}
          </select>
          {errors.specialty_id && <p className="mt-1 text-sm text-destructive">{errors.specialty_id.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">E-mail</label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-2">Clínicas Vinculadas *</label>
          <div className="mt-1 space-y-2 max-h-48 overflow-y-auto p-3 border rounded-md bg-background/50">
            {clinics.map((c) => (
              <label key={c.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-accent/50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  value={c.id}
                  {...register('clinic_ids')}
                  disabled={userRole !== 'SMS_ADMIN' && c.id !== userClinicId}
                  className="rounded border-input text-primary focus:ring-ring bg-background"
                />
                <span className="text-foreground">{c.name}</span>
              </label>
            ))}
          </div>
          {errors.clinic_ids && <p className="mt-1 text-sm text-destructive">{errors.clinic_ids.message}</p>}
          {userRole !== 'SMS_ADMIN' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Como usuário de clínica, você só pode gerenciar o vínculo com sua própria clínica.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...register('active')}
              className="rounded border-input text-primary focus:ring-ring bg-background"
            />
            <span className="text-sm font-medium text-foreground">Ativo</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
