'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clinicSchema, type ClinicFormData } from './schema'
import { createClinicAction, updateClinicAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCNPJ } from '@/lib/validation-utils'
import { MapPin, ExternalLink } from 'lucide-react'

export function ClinicForm({ initialData, id }: { initialData?: Partial<ClinicFormData>; id?: string }) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
      competence_end_day: initialData?.competence_end_day || 31,
      competence_deadline_day: initialData?.competence_deadline_day || 5,
      latitude: initialData?.latitude || null,
      longitude: initialData?.longitude || null,
    },
  })

  // CNPJ Mask handler
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setValue('cnpj', formatted, { shouldValidate: true })
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('latitude', position.coords.latitude)
        setValue('longitude', position.coords.longitude)
      },
      (error) => {
        alert('Erro ao obter localização: ' + error.message)
      }
    )
  }

  const onSubmit = async (data: ClinicFormData) => {
    setIsPending(true)
    setErrorMsg('')

    try {
      let result
      if (id) {
        result = await updateClinicAction(id, data)
      } else {
        result = await createClinicAction(data)
      }

      if (result && result.error) {
        setErrorMsg(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-4xl bg-card text-card-foreground p-10 rounded-2xl shadow-xl border border-border/40 mb-10">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {errorMsg}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Nome Fantasia *</label>
          <input
            type="text"
            {...register('name')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
            placeholder="Ex: Clínica Esperança"
          />
          {errors.name && <p className="mt-1 text-sm text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2 pb-4 border-b border-border/30">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Razão Social *</label>
          <input
            type="text"
            {...register('corporate_name')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
            placeholder="Ex: Clínica Esperança Ltda"
          />
          {errors.corporate_name && <p className="mt-1 text-sm text-rose-500">{errors.corporate_name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">CNPJ *</label>
          <input
            type="text"
            {...register('cnpj')}
            onChange={handleCNPJChange}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all font-mono"
            placeholder="00.000.000/0000-00"
          />
          {errors.cnpj && <p className="mt-1 text-sm text-rose-500">{errors.cnpj.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">CNES *</label>
          <input
            type="text"
            {...register('cnes')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all font-mono"
            placeholder="Ex: 1234567"
          />
          {errors.cnes && <p className="mt-1 text-sm text-rose-500">{errors.cnes.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Endereço Completo</label>
          <input
            type="text"
            {...register('address')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
            placeholder="Rua, número, bairro, cidade, CEP..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Contato Telefônico</label>
          <input
            type="text"
            {...register('phone')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
            placeholder="(00) 00000-0000"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">E-mail de Contato</label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
            placeholder="contato@clinica.com"
          />
          {errors.email && <p className="mt-1 text-sm text-rose-500">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2 pt-6 border-t border-border/30">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">Configuração de Competência</h3>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="bg-muted/10 p-5 rounded-2xl border border-border/40">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Dia Final do Período</label>
              <input
                type="number"
                min="1"
                max="31"
                {...register('competence_end_day')}
                className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
                placeholder="Ex: 25"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">Ex: Se 25, a competência de Abril será do dia 26/03 até 25/04.</p>
              {errors.competence_end_day && <p className="mt-1 text-sm text-rose-500">{errors.competence_end_day.message}</p>}
            </div>

            <div className="bg-muted/10 p-5 rounded-2xl border border-border/40">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Dia Limite p/ Fechamento</label>
              <input
                type="number"
                min="1"
                max="31"
                {...register('competence_deadline_day')}
                className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
                placeholder="Ex: 10"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">Ex: A clínica terá até o dia 10 do mês seguinte para encerrar a competência.</p>
              {errors.competence_deadline_day && <p className="mt-1 text-sm text-rose-500">{errors.competence_deadline_day.message}</p>}
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 pt-6 border-t border-border/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Coordenadas de Auditoria (Geofencing)</h3>
            <div className="flex items-center gap-2">
              {watch('latitude') && watch('longitude') && (
                <a
                  href={`https://www.google.com/maps/place/${watch('latitude')},${watch('longitude')}/@${watch('latitude')},${watch('longitude')},20z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-widest bg-muted/20 px-3 py-1.5 rounded-lg border border-border transition-all active:scale-95"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver no Mapa (Zoom 10m)
                </a>
              )}
              <button
                type="button"
                onClick={getCurrentLocation}
                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 transition-all active:scale-95"
              >
                <MapPin className="h-3 w-3" />
                Obter Localização Atual
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="bg-muted/10 p-5 rounded-2xl border border-border/40">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Latitude</label>
              <input
                type="text"
                {...register('latitude', {
                  setValueAs: (v) => v ? parseFloat(v.toString().replace(',', '.')) : null
                })}
                className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all font-mono"
                placeholder="Ex: -5.362346"
              />
            </div>

            <div className="bg-muted/10 p-5 rounded-2xl border border-border/40">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Longitude</label>
              <input
                type="text"
                {...register('longitude', {
                  setValueAs: (v) => v ? parseFloat(v.toString().replace(',', '.')) : null
                })}
                className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all font-mono"
                placeholder="Ex: -49.115798"
              />
            </div>
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground italic bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
            * Estas coordenadas são usadas para validar a presença física durante a assinatura do QR Code. 
            Recomenda-se capturar as coordenadas estando fisicamente na recepção da clínica.
          </p>
        </div>

        <div className="sm:col-span-2 bg-muted/20 p-6 rounded-2xl border border-border/40">
          <label className="flex items-center space-x-3 group cursor-pointer">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded-lg border-border/60 text-primary focus:ring-primary/10 bg-background transition-all"
            />
            <div className="space-y-0.5">
              <span className="text-[11px] font-black text-foreground uppercase tracking-widest group-hover:text-primary transition-colors">Clínica Ativa</span>
              <p className="text-[10px] text-muted-foreground font-medium">Define se a clínica aparecerá nos novos atendimentos e relatórios.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-4 border-t border-border/30 pt-8 mt-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-border bg-background px-6 py-2.5 text-sm font-bold text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-all active:scale-95"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center rounded-xl bg-primary px-10 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50 transition-all active:scale-95"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processando...
            </span>
          ) : (
            id ? 'Atualizar Clínica' : 'Salvar Clínica'
          )}
        </button>
      </div>
    </form>
  )
}
