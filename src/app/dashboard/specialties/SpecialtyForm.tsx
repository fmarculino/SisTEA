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
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      name: initialData?.name || '',
      cbo: initialData?.cbo || '',
    },
  })

  async function onSubmit(data: SpecialtyFormData) {
    setIsPending(true)
    setErrorMsg('')
    try {
      if (id) {
        await updateSpecialtyAction(id, data)
      } else {
        await createSpecialtyAction(data)
      }
      router.push('/dashboard/specialties')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar especialidade'
      setErrorMsg(message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-card p-6 rounded-lg border border-border shadow-sm">
      {errorMsg && (
        <div className="rounded-md bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label className="block text-sm font-medium text-foreground">Nome da Especialidade / Função *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">CBO *</label>
          <input
            type="text"
            {...register('cbo')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
            placeholder="Ex: 223505"
          />
          {errors.cbo && <p className="mt-1 text-sm text-destructive">{errors.cbo.message}</p>}
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
