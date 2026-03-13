'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { specialtySchema, type SpecialtyFormData } from './schema'
import { createSpecialtyAction, updateSpecialtyAction } from './actions'

export function SpecialtyForm({ 
  initialData, 
  id 
}: { 
  initialData?: Partial<SpecialtyFormData>; 
  id?: string;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SpecialtyFormData>({
    resolver: zodResolver(specialtySchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      cbo: initialData?.cbo || '',
      active: initialData?.active ?? true,
    },
  })

  async function onSubmit(data: SpecialtyFormData) {
    setIsPending(true)
    setErrorMsg('')
    try {
      let result
      if (id) {
        result = await updateSpecialtyAction(id, data)
      } else {
        result = await createSpecialtyAction(data)
      }

      if (result && 'error' in result && result.error) {
        setErrorMsg(result.error)
      } else {
        router.push('/dashboard/specialties')
        router.refresh()
      }
    } catch (error) {
      setErrorMsg('Erro inesperado ao salvar especialidade')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-card p-8 rounded-xl border border-border shadow-xl">
      {errorMsg && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 mb-4 animate-in fade-in slide-in-from-top-1">
          <p className="text-sm text-destructive font-medium">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">CBO *</label>
          <input
            type="text"
            {...register('cbo')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all font-mono"
            placeholder="Ex: 223505"
          />
          {errors.cbo && <p className="mt-1 text-xs text-destructive font-bold">{errors.cbo.message}</p>}
        </div>

        <div className="sm:col-span-4">
          <label className="block text-sm font-semibold text-foreground mb-1 uppercase tracking-tight">Nome da Especialidade / Função *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-lg border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-2.5 border bg-background transition-all"
            placeholder="Ex: Fonoaudiólogo"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive font-bold">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-6">
          <label className="flex items-center space-x-3 group cursor-pointer">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
            />
            <span className="text-sm font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Especialidade Ativa</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
