'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { attendanceSchema, type AttendanceFormData } from './schema'
import { createAttendanceAction, updateAttendanceAction } from './actions'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumberBR } from '@/utils/format'

export function AttendanceForm({ 
  initialData, 
  id,
  patients,
  professionals,
  procedures,
  userClinicId,
  userRole,
  clinics
}: { 
  initialData?: Partial<AttendanceFormData>; 
  id?: string;
  patients: any[];
  professionals: any[];
  procedures: any[];
  userClinicId?: string | null;
  userRole: string;
  clinics?: any[];
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const defaultClinicId = userRole === 'SMS_ADMIN' 
    ? (initialData?.clinic_id || '') 
    : (userClinicId || '')

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema) as any,
    defaultValues: {
      patient_id: initialData?.patient_id || '',
      professional_id: initialData?.professional_id || '',
      procedure_id: initialData?.procedure_id || '',
      clinic_id: defaultClinicId,
      attendance_date: initialData?.attendance_date || new Date().toISOString().split('T')[0],
      auth_number: initialData?.auth_number || '',
      authorization_date: initialData?.authorization_date || '',
      authorized_quantity: initialData?.authorized_quantity || 20,
      cid: initialData?.cid || '',
      attendance_character: initialData?.attendance_character || '',
      value_applied: initialData?.value_applied || 0,
      notes: initialData?.notes || '',
      sessions: initialData?.sessions || [],
    },
  })

  const { fields: sessionFields, append, remove } = useFieldArray({
    control,
    name: 'sessions',
  })

  // Watch for procedure_id change to auto-fill the value
  const selectedProcedureId = watch('procedure_id')
  const authorizedQuantity = watch('authorized_quantity')
  const sessions = watch('sessions')

  // Calculate value based on realized sessions
  useEffect(() => {
    if (selectedProcedureId && sessions) {
      const proc = procedures.find((p) => p.id === selectedProcedureId)
      if (proc) {
        const realizedCount = sessions.filter(s => s.status === 'Realizada').length
        const totalValue = realizedCount * Number(proc.valor_total || 0)
        setValue('value_applied', totalValue)
      }
    }
  }, [selectedProcedureId, sessions, procedures, setValue])

  const onSubmit = async (data: AttendanceFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updateAttendanceAction(id, data)
    } else {
      result = await createAttendanceAction(data)
    }

    if (result && result.error) {
      setErrorMsg(result.error)
      setIsPending(false)
    }
  }

  // Filter patients and professionals by selected clinic if SMS_ADMIN
  const selectedClinicId = watch('clinic_id')
  const filteredPatients = userRole === 'SMS_ADMIN' && selectedClinicId
    ? patients.filter(p => p.clinic_id === selectedClinicId)
    : patients
  
  const filteredProfessionals = userRole === 'SMS_ADMIN' && selectedClinicId
    ? professionals.filter(p => p.professional_clinics?.some((pc: any) => pc.clinic_id === selectedClinicId))
    : professionals

  const calculateEndTime = (startTime: string, minutesToAdd: number) => {
    if (!startTime) return ''
    const [hours, minutes] = startTime.split(':').map(Number)
    const date = new Date()
    date.setHours(hours)
    date.setMinutes(minutes + minutesToAdd)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-4xl bg-card text-card-foreground p-8 rounded-2xl shadow-xl border border-border/40 mb-10">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {errorMsg}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {userRole === 'SMS_ADMIN' && (
          <div className="sm:col-span-2 bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10 mb-2">
            <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Unidade de Saúde (Clínica)</label>
            <select
              {...register('clinic_id')}
              className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background/50 transition-all"
            >
              <option value="">Selecione a clínica responsável...</option>
              {clinics?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-2 text-[10px] text-amber-600/70 font-medium">A seleção da clínica filtra os pacientes e profissionais disponíveis abaixo.</p>
            {errors.clinic_id && <p className="mt-1 text-sm text-rose-500">{errors.clinic_id.message}</p>}
          </div>
        )}

        {/* hidden input if not admin */}
        {userRole !== 'SMS_ADMIN' && (
          <input type="hidden" {...register('clinic_id')} />
        )}

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Paciente *</label>
          <select
            {...register('patient_id')}
            disabled={userRole === 'SMS_ADMIN' && !selectedClinicId}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background transition-all disabled:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Selecione um paciente...</option>
            {filteredPatients.length > 0 ? (
              filteredPatients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            ) : (
              <option value="" disabled>
                {userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Selecione a clínica primeiro' 
                  : 'Nenhum paciente encontrado'}
              </option>
            )}
          </select>
          {errors.patient_id && <p className="mt-1 text-sm text-rose-500">{errors.patient_id.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Profissional de Saúde *</label>
          <select
            {...register('professional_id')}
            disabled={userRole === 'SMS_ADMIN' && !selectedClinicId}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background transition-all disabled:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Selecione um profissional...</option>
            {filteredProfessionals.length > 0 ? (
              filteredProfessionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>
              ))
            ) : (
              <option value="" disabled>
                {userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Selecione a clínica primeiro' 
                  : 'Nenhum profissional encontrado'}
              </option>
            )}
          </select>
          {errors.professional_id && <p className="mt-1 text-sm text-rose-500">{errors.professional_id.message}</p>}
        </div>

        <div className="sm:col-span-2 pb-2 border-b border-border/30">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Procedimento / Serviço *</label>
          <select
            {...register('procedure_id')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background transition-all"
          >
            <option value="">Escolha o procedimento realizado...</option>
            {procedures.length > 0 ? (
              procedures.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Valor: {formatCurrency(p.valor_total)} / sessão)</option>
              ))
            ) : (
              <option value="" disabled>Nenhum procedimento ativo</option>
            )}
          </select>
          {errors.procedure_id && <p className="mt-1 text-sm text-rose-500">{errors.procedure_id.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Data da Guia *</label>
          <input
            type="date"
            {...register('attendance_date')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all"
          />
          {errors.attendance_date && <p className="mt-1 text-sm text-rose-500">{errors.attendance_date.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Nº de Autorização (Guia)</label>
          <input
            type="text"
            placeholder="Ex: 12345678"
            {...register('auth_number')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Data de Autorização</label>
          <input
            type="date"
            {...register('authorization_date')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Qtd. Autorizada</label>
          <input
            type="number"
            {...register('authorized_quantity')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">CID principal</label>
          <input
            type="text"
            placeholder="Ex: F84.0"
            {...register('cid')}
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Caráter de Atendimento</label>
          <select
             {...register('attendance_character')}
             className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background transition-all"
          >
            <option value="">Selecione...</option>
            <option value="Eletivo">Eletivo</option>
            <option value="Urgência">Urgência</option>
          </select>
        </div>

        <div className="sm:col-span-2 bg-primary/5 p-6 rounded-2xl border border-primary/10">
          <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-1">Valor Total Estimado (R$)</label>
          <div className="flex items-center gap-4">
            <div className="mt-1 block w-full max-w-[200px] rounded-xl border-transparent shadow-sm sm:text-lg font-bold px-4 py-2.5 bg-background text-primary min-h-[46px] flex items-center">
              {formatNumberBR(watch('value_applied'))}
              <input type="hidden" {...register('value_applied', { valueAsNumber: true })} />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium flex-1">
              Calculado: (<span className="text-foreground font-bold">{sessions?.filter(s => s.status === 'Realizada').length || 0}</span> sessões realizadas) × valor unitário.
            </p>
          </div>
          {errors.value_applied && <p className="mt-1 text-sm text-rose-500">{errors.value_applied.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Observações Adicionais</label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Alguma informação relevante sobre este faturamento..."
            className="mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-3 border bg-background transition-all"
          />
        </div>
      </div>

      {/* SESSÕES */}
      <div className="mt-12 space-y-6 pt-10 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Registro de Frequência</h3>
            <p className="text-sm text-muted-foreground mt-1">Lançamento detalhado das sessões autorizadas.</p>
          </div>
          <button
            type="button"
            disabled={sessionFields.length >= authorizedQuantity}
            onClick={() => append({ session_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '08:50', status: 'Realizada' })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {sessionFields.length >= authorizedQuantity ? 'Limite Atingido' : '+ Adicionar Sessão'}
          </button>
        </div>
        
        {sessionFields.length === 0 && (
          <div className="py-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
            <p className="text-sm text-muted-foreground font-medium italic">Nenhuma sessão registrada. Clique no botão acima para iniciar o lançamento.</p>
          </div>
        )}

        <div className="space-y-4">
          {sessionFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end p-5 bg-muted/10 border border-border/40 rounded-2xl relative group transition-all hover:bg-muted/20 hover:border-border/60">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Data</label>
                <input
                  type="date"
                  {...register(`sessions.${index}.session_date` as const)}
                  className="block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Início</label>
                <input
                  type="time"
                  {...register(`sessions.${index}.start_time` as const, {
                    onChange: (e) => {
                      const endTime = calculateEndTime(e.target.value, 50)
                      if (endTime) {
                        setValue(`sessions.${index}.end_time`, endTime)
                      }
                    }
                  })}
                  className="block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Fim</label>
                <input
                  type="time"
                  {...register(`sessions.${index}.end_time` as const)}
                  className="block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Situação</label>
                <select
                  {...register(`sessions.${index}.status` as const)}
                  className="block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all"
                >
                  <option value="Realizada">Realizada</option>
                  <option value="Falta do Paciente">Falta do Paciente</option>
                  <option value="Falta do Profissional">Falta do Profissional</option>
                  <option value="Feriado">Feriado</option>
                  <option value="Atestado Médico">Atestado Médico</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-rose-500 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  Remover
                </button>
              </div>
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-primary/20 group-hover:bg-primary transition-all" />
            </div>
          ))}
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
            id ? 'Atualizar Guia' : 'Salvar Atendimento'
          )}
        </button>
      </div>
    </form>
  )
}
