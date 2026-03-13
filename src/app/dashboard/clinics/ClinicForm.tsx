'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clinicSchema, type ClinicFormData } from './schema'
import { createClinicAction, updateClinicAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ClinicForm({ intialData, id }: { intialData?: Partial<ClinicFormData>; id?: string }) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema) as any,
    defaultValues: {
      name: intialData?.name || '',
      cnpj: intialData?.cnpj || '',
      cnes: intialData?.cnes || '',
      corporate_name: intialData?.corporate_name || '',
      address: intialData?.address || '',
      phone: intialData?.phone || '',
      email: intialData?.email || '',
      active: intialData?.active ?? true,
    },
  })

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card text-card-foreground p-6 rounded-lg shadow border">
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Nome Fantasia *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">CNPJ</label>
          <input
            type="text"
            {...register('cnpj')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">CNES</label>
          <input
            type="text"
            {...register('cnes')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Razão Social</label>
          <input
            type="text"
            {...register('corporate_name')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Endereço</label>
          <input
            type="text"
            {...register('address')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Telefone</label>
          <input
            type="text"
            {...register('phone')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">E-mail</label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
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
