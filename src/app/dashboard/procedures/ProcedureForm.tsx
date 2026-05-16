'use client'

import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { procedureSchema, type ProcedureFormData } from './schema'
import { createProcedureAction, updateProcedureAction } from './actions'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { MultiSearchSelect } from '@/components/ui/MultiSearchSelect'
import { applyMask } from '@/utils/maskUtils'

type SpecialtyOption = { id: string; name: string; cbo: string }
type ServiceClassificationOption = { id: string; name: string; service_code: string; classification_code: string }
type CidOption = { id: string; name: string; code: string }

export function ProcedureForm({ 
  initialData, 
  id,
  specialties = [],
  serviceClassifications = [],
  cidList = []
}: { 
  initialData?: Partial<ProcedureFormData>; 
  id?: string;
  specialties?: SpecialtyOption[];
  serviceClassifications?: ServiceClassificationOption[];
  cidList?: CidOption[];
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
      code: initialData?.code ? applyMask(initialData.code, 'procedure') : '',
      hasNoCode: !initialData?.code && !!id, 
      name: initialData?.name || '',
      description: initialData?.description || '',
      valor_sus: initialData?.valor_sus || 0,
      valor_rp: initialData?.valor_rp || 0,
      bpa_type: initialData?.bpa_type || 'NAO_APLICA',
      active: initialData?.active ?? true,
      specialty_ids: initialData?.specialty_ids || [],
      service_classification_ids: initialData?.service_classification_ids || [],
      cid_ids: initialData?.cid_ids || [],
      max_quantity: initialData?.max_quantity ?? null,
      min_age: initialData?.min_age ?? null,
      max_age: initialData?.max_age ?? null,
    },
  })

  // Watch values for total calculation
  const valorSus = useWatch({ control, name: 'valor_sus' })
  const valorRp = useWatch({ control, name: 'valor_rp' })
  const hasNoCode = useWatch({ control, name: 'hasNoCode' })
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    const sus = Number(valorSus) || 0
    const rp = Number(valorRp) || 0
    setTotalValue(sus + rp)
  }, [valorSus, valorRp])

  useEffect(() => {
    if (hasNoCode) {
      setValue('code', '', { shouldValidate: true })
      setValue('bpa_type', 'NAO_APLICA', { shouldValidate: true })
    }
  }, [hasNoCode, setValue])

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
    const cleanValue = value.replace(/\D/g, '')
    let numericValue = Number(cleanValue) / 100
    if (isNaN(numericValue)) numericValue = 0
    setValue(name, numericValue, { shouldValidate: true })
  }

  const onSubmit = async (data: ProcedureFormData) => {
    setIsPending(true)
    setErrorMsg('')

    try {
      let result
      if (id) {
        result = await updateProcedureAction(id, data)
      } else {
        result = await createProcedureAction(data)
      }

      if (result && result.error) {
        setErrorMsg(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-card text-card-foreground p-8 rounded-[2rem] shadow-2xl border border-border/40">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm mb-4 border border-destructive/20 font-medium">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest">Código SUS *</label>
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                {...register('hasNoCode')}
                className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
              />
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter group-hover:text-primary transition-colors">Sem código</span>
            </label>
          </div>
          <input
            type="text"
            placeholder={hasNoCode ? "Não aplicável" : "00.00.00.000-0"}
            {...register('code')}
            onChange={handleSUSCodeChange}
            disabled={hasNoCode}
            className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 disabled:opacity-50 font-mono font-bold"
          />
          {errors.code && <p className="mt-1 text-xs text-destructive font-bold">{errors.code.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Nome do Procedimento *</label>
          <input
            type="text"
            {...register('name')}
            className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 font-bold"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive font-bold">{errors.name.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Descrição</label>
          <textarea
            {...register('description')}
            rows={2}
            className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 font-medium"
          />
        </div>

        {/* RESTRIÇÕES */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 rounded-2xl border border-dashed border-border bg-muted/5">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest">Qtd. Máxima (Lançamento)</label>
            <div className="group relative">
              <div className="cursor-help text-primary/60 hover:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
              </div>
              <div className="absolute left-0 bottom-full mb-2 w-64 p-4 bg-card border border-border shadow-2xl rounded-2xl text-[11px] text-foreground font-medium leading-relaxed hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-primary/10 text-primary font-black uppercase tracking-tighter mb-2 px-2 py-1 rounded-lg w-fit">Regra de Limite</div>
                Define o teto de frequências permitidas. O limite é aplicado por <span className="font-bold text-primary">Profissional + Paciente</span> dentro da mesma <span className="font-bold text-primary">Competência (Mês/Ano)</span>. 
                <br/><br/>
                Exemplo: se o limite for 20, o Profissional A pode lançar 20 sessões e o Profissional B outras 20 para o mesmo paciente no mesmo mês.
                <br/><br/>
                <span className="italic opacity-70 italic text-[10px]">Deixe em branco para ilimitado.</span>
                <div className="absolute top-full left-4 border-8 border-transparent border-t-card"></div>
              </div>
            </div>
          </div>
            <input
              type="number"
              {...register('max_quantity')}
              placeholder="Sem limite"
              className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-background font-bold"
            />
            <p className="mt-1 text-[9px] text-muted-foreground italic">Limite de execuções permitidas.</p>
          </div>
          
          <div className="col-span-1">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Idade Mínima ({'>'}=)</label>
            <input
              type="number"
              {...register('min_age')}
              placeholder="Ex: 2"
              className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-background font-bold"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Idade Máxima ({'<'}=)</label>
            <input
              type="number"
              {...register('max_age')}
              placeholder="Ex: 18"
              className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-background font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Valor SUS (R$) *</label>
            <Controller
              name="valor_sus"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  value={formatNumberBR(field.value)}
                  onChange={(e) => handleCurrencyChange('valor_sus', e.target.value)}
                  className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 font-bold"
                />
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Valor Repasse (R$) *</label>
            <Controller
              name="valor_rp"
              control={control}
              render={({ field }) => (
                <input
                  type="text"
                  value={formatNumberBR(field.value)}
                  onChange={(e) => handleCurrencyChange('valor_rp', e.target.value)}
                  className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 font-bold"
                />
              )}
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Instrumento de Registro (BPA)</label>
          <select
            {...register('bpa_type')}
            disabled={hasNoCode}
            className="block w-full rounded-xl border-border/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm px-4 py-3 border bg-muted/30 disabled:opacity-50 font-bold appearance-none bg-no-repeat bg-[right_1rem_center] cursor-pointer"
          >
            <option value="NAO_APLICA">Não se Aplica (Não exportar)</option>
            <option value="BPA_I">BPA-I (Individualizado)</option>
            <option value="BPA_C">BPA-C (Consolidado)</option>
            <option value="AMBOS">Ambos</option>
          </select>
          <p className="mt-2 text-[10px] text-muted-foreground font-medium italic">Define se este procedimento será incluído no arquivo de exportação do DATASUS.</p>
        </div>

        <div className="sm:col-span-2 bg-primary/5 p-6 rounded-2xl border border-primary/10 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-primary uppercase tracking-widest">Valor Total do Procedimento</span>
            <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(totalValue)}</span>
          </div>
          <p className="mt-1 text-[10px] text-primary/60 font-medium italic uppercase tracking-tighter">Soma do Valor SUS + Valor Repasse</p>
        </div>

        <div className="sm:col-span-2 space-y-10 mt-6 border-t border-border/40 pt-10">
          <h3 className="text-sm font-black text-primary uppercase tracking-[0.3em]">Configurações Avançadas e Vínculos</h3>

          {/* Especialidades */}
          <Controller
            name="specialty_ids"
            control={control}
            render={({ field }) => (
              <MultiSearchSelect
                label="Ocupação (Especialidades Autorizadas) *"
                options={specialties}
                value={field.value}
                onChange={field.onChange}
                placeholder="Pesquisar por nome ou código CBO..."
                emptyMessage="Especialidade não encontrada"
              />
            )}
          />
          {errors.specialty_ids && (
            <p className="mt-1 text-[10px] text-destructive font-black uppercase tracking-tighter">
              {errors.specialty_ids.message}
            </p>
          )}

          {/* Classificação DATASUS */}
          <Controller
            name="service_classification_ids"
            control={control}
            render={({ field }) => (
              <MultiSearchSelect
                label="Serviço / Classificação (BPA)"
                options={serviceClassifications.map(sc => ({
                  ...sc,
                  code: `${sc.service_code}/${sc.classification_code}`
                }))}
                value={field.value}
                onChange={field.onChange}
                placeholder="Pesquisar por nome ou código (S:XXX / C:XXX)..."
                emptyMessage="Serviço/Classificação não encontrado"
              />
            )}
          />

          {/* CIDs Autorizados */}
          <Controller
            name="cid_ids"
            control={control}
            render={({ field }) => (
              <MultiSearchSelect
                label="CIDs Autorizados"
                options={cidList}
                value={field.value}
                onChange={field.onChange}
                placeholder="Pesquisar por código CID ou nome da doença..."
                emptyMessage="CID não encontrado"
              />
            )}
          />
        </div>

        <div className="sm:col-span-2 pt-4">
          <label className="flex items-center space-x-3 group cursor-pointer w-fit">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded border-input text-primary focus:ring-primary/20 bg-background transition-all"
            />
            <span className="text-sm font-black text-foreground uppercase tracking-[0.2em] group-hover:text-primary transition-colors">Procedimento Ativo</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-4 border-t border-border/40 pt-8 mt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-border/40 bg-background px-6 py-3 text-[11px] font-black text-muted-foreground uppercase tracking-widest shadow-sm hover:bg-muted transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center rounded-xl bg-primary px-8 py-3 text-[11px] font-black text-primary-foreground uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-50 transition-all active:scale-95"
        >
          {isPending ? 'Processando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  )
}
