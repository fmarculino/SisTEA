'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { procedureSchema, type ProcedureFormData } from './schema'
import { createProcedureAction, updateProcedureAction } from './actions'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumberBR } from '@/utils/format'

type SpecialtyOption = { id: string; name: string; cbo: string }

export function ProcedureForm({ 
  initialData, 
  id,
  specialties = []
}: { 
  initialData?: Partial<ProcedureFormData>; 
  id?: string;
  specialties?: SpecialtyOption[];
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProcedureFormData>({
    resolver: zodResolver(procedureSchema) as any,
    defaultValues: {
      code: initialData?.code || '',
      name: initialData?.name || '',
      description: initialData?.description || '',
      valor_sus: initialData?.valor_sus || 0,
      valor_rp: initialData?.valor_rp || 0,
      active: initialData?.active ?? true,
      specialty_ids: initialData?.specialty_ids || [],
    },
  })

  // Watch values for total calculation
  const valorSus = useWatch({ control, name: 'valor_sus' })
  const valorRp = useWatch({ control, name: 'valor_rp' })
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    const sus = Number(valorSus) || 0
    const rp = Number(valorRp) || 0
    setTotalValue(sus + rp)
  }, [valorSus, valorRp])

  const formatSUSCode = (value: string) => {
    const digits = value.replace(/\D/g, '')
    let formatted = digits
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`
    if (digits.length > 4) formatted = `${formatted.slice(0, 5)}.${formatted.slice(5)}`
    if (digits.length > 6) formatted = `${formatted.slice(0, 8)}.${formatted.slice(8)}`
    if (digits.length > 9) formatted = `${formatted.slice(0, 12)}-${formatted.slice(12, 13)}`
    return formatted.slice(0, 14)
  }

  const handleSUSCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSUSCode(e.target.value)
    setValue('code', formatted, { shouldValidate: true })
  }

  const handleCurrencyChange = (name: 'valor_sus' | 'valor_rp', value: string) => {
    // Remove all non-digits
    const cleanValue = value.replace(/\D/g, '')
    // Convert to number (cents / 100)
    const numericValue = Number(cleanValue) / 100
    setValue(name, numericValue, { shouldValidate: true })
  }

  const onSubmit = async (data: ProcedureFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updateProcedureAction(id, data)
    } else {
      result = await createProcedureAction(data)
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
        <div>
          <label className="block text-sm font-medium text-foreground">Código SUS *</label>
          <input
            type="text"
            placeholder="00.00.00.000-0"
            {...register('code')}
            onChange={handleSUSCodeChange}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.code && <p className="mt-1 text-sm text-destructive">{errors.code.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Nome do Procedimento *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Descrição</label>
          <textarea
            {...register('description')}
            rows={3}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Valor SUS (R$) *</label>
          <input
            type="text"
            {...register('valor_sus')}
            value={formatNumberBR(valorSus)}
            onChange={(e) => handleCurrencyChange('valor_sus', e.target.value)}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.valor_sus && <p className="mt-1 text-sm text-destructive">{errors.valor_sus.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Valor Repasse (R$) *</label>
          <input
            type="text"
            {...register('valor_rp')}
            value={formatNumberBR(valorRp)}
            onChange={(e) => handleCurrencyChange('valor_rp', e.target.value)}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.valor_rp && <p className="mt-1 text-sm text-destructive">{errors.valor_rp.message}</p>}
        </div>

        <div className="sm:col-span-2 bg-accent/10 p-4 rounded-lg border border-dashed border-accent">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground uppercase tracking-wider">Valor Total do Procedimento</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground italic">Soma do Valor SUS + Valor Repasse</p>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight mb-2 italic">OCUPAÇÃO (Especialidades autorizadas) *</label>
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
