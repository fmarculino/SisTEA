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
      cns: initialData?.cns || '',
      specialty_ids: initialData?.specialty_ids || [],
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
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Nome do Profissional *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Nome completo"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive font-bold">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">CPF</label>
          <input
            type="text"
            {...register('cpf')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="000.000.000-00 (Opcional)"
          />
          {errors.cpf && <p className="mt-1 text-xs text-destructive font-bold">{errors.cpf.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">CNS (Cartão Nac. Saúde) *</label>
          <input
            type="text"
            {...register('cns')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="000 0000 0000 0000"
          />
          {errors.cns && <p className="mt-1 text-xs text-destructive font-bold">{errors.cns.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Tipo Documento (CRP, CRM, etc)</label>
          <input
            type="text"
            {...register('document_type')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Ex: CRM"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Número do Documento</label>
          <input
            type="text"
            {...register('document_number')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="00000"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight mb-2">Especialidades / Funções *</label>
          <div className="mt-1 space-y-2 max-h-48 overflow-y-auto p-4 border rounded-xl bg-background/50 backdrop-blur-sm border-dashed">
            {specialties.map((s) => (
              <label key={s.id} className="flex items-center space-x-3 text-sm cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-all group">
                <input
                  type="checkbox"
                  value={s.id}
                  {...register('specialty_ids')}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
                />
                <span className="text-foreground group-hover:text-primary transition-colors">{s.name} (CBO: {s.cbo})</span>
              </label>
            ))}
          </div>
          {errors.specialty_ids && <p className="mt-1 text-xs text-destructive font-bold">{errors.specialty_ids.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">E-mail</label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="email@exemplo.com"
          />
          {errors.email && <p className="mt-1 text-xs text-destructive font-bold">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight mb-2">Clínicas Vinculadas *</label>
          <div className="mt-1 space-y-2 max-h-48 overflow-y-auto p-4 border rounded-xl bg-background/50 backdrop-blur-sm border-dashed">
            {clinics.map((c) => (
              <label key={c.id} className="flex items-center space-x-3 text-sm cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-all group">
                <input
                  type="checkbox"
                  value={c.id}
                  {...register('clinic_ids')}
                  disabled={userRole !== 'SMS_ADMIN' && c.id !== userClinicId}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
                />
                <span className="text-foreground group-hover:text-primary transition-colors">{c.name}</span>
              </label>
            ))}
          </div>
          {errors.clinic_ids && <p className="mt-1 text-xs text-destructive font-bold">{errors.clinic_ids.message}</p>}
          {userRole !== 'SMS_ADMIN' && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              Como usuário de clínica, você só pode gerenciar o vínculo com sua própria clínica.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center space-x-3 group cursor-pointer">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
            />
            <span className="text-sm font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Profissional Ativo</span>
          </label>
        </div>
      </div>

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
          {isPending ? 'SALVANDO...' : 'SALVAR PROFISSIONAL'}
        </button>
      </div>
    </form>
  )
}
