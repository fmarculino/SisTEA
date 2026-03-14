'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clinicSchema, type ClinicFormData } from './schema'
import { createClinicAction, updateClinicAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCNPJ } from '@/lib/validation-utils'

export function ClinicForm({ initialData, id }: { initialData?: Partial<ClinicFormData>; id?: string }) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      cnpj: initialData?.cnpj || '',
      cnes: initialData?.cnes || '',
      corporate_name: initialData?.corporate_name || '',
      address: initialData?.address || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      active: initialData?.active ?? true,
    },
  })

  // CNPJ Mask handler
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setValue('cnpj', formatted, { shouldValidate: true })
  }

  const onSubmit = async (data: ClinicFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updateClinicAction(id, data)
    } else {
      result = await createClinicAction(data)
    }

    if (result && result.error) {
      setErrorMsg(result.error)
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl bg-card text-card-foreground p-8 rounded-xl shadow-xl border border-border">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm mb-4 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Nome Fantasia *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Ex: Clínica Esperança"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive font-bold">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Razão Social *</label>
          <input
            type="text"
            {...register('corporate_name')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Ex: Clínica Esperança Ltda"
          />
          {errors.corporate_name && <p className="mt-1 text-xs text-destructive font-bold">{errors.corporate_name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">CNPJ *</label>
          <input
            type="text"
            {...register('cnpj')}
            onChange={handleCNPJChange}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="00.000.000/0000-00"
          />
          {errors.cnpj && <p className="mt-1 text-xs text-destructive font-bold">{errors.cnpj.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">CNES *</label>
          <input
            type="text"
            {...register('cnes')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="Ex: 1234567"
          />
          {errors.cnes && <p className="mt-1 text-xs text-destructive font-bold">{errors.cnes.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Endereço</label>
          <input
            type="text"
            {...register('address')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Rua, número, bairro..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Telefone</label>
          <input
            type="text"
            {...register('phone')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="(00) 00000-0000"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">E-mail</label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="contato@clinica.com"
          />
          {errors.email && <p className="mt-1 text-xs text-destructive font-bold">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center space-x-3 group cursor-pointer">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
            />
            <span className="text-sm font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Clínica Ativa</span>
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
          {isPending ? 'SALVANDO...' : 'SALVAR CLÍNICA'}
        </button>
      </div>
    </form>
  )
}
