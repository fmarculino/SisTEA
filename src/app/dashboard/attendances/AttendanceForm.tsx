'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { attendanceSchema, type AttendanceFormData } from './schema'
import { createAttendanceAction, updateAttendanceAction } from './actions'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AttendanceForm({ 
  intialData, 
  id,
  patients,
  professionals,
  procedures,
  userClinicId,
  userRole,
  clinics
}: { 
  intialData?: Partial<AttendanceFormData>; 
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
    ? (intialData?.clinic_id || '') 
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
      patient_id: intialData?.patient_id || '',
      professional_id: intialData?.professional_id || '',
      procedure_id: intialData?.procedure_id || '',
      clinic_id: defaultClinicId,
      attendance_date: intialData?.attendance_date || new Date().toISOString().split('T')[0],
      auth_number: intialData?.auth_number || '',
      authorization_date: intialData?.authorization_date || '',
      authorized_quantity: intialData?.authorized_quantity || 20,
      cid: intialData?.cid || '',
      attendance_character: intialData?.attendance_character || '',
      value_applied: intialData?.value_applied || 0,
      notes: intialData?.notes || '',
      sessions: intialData?.sessions || [],
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card text-card-foreground p-6 rounded-lg shadow border">
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {userRole === 'SMS_ADMIN' && (
          <div className="sm:col-span-2 bg-yellow-500/10 p-4 rounded-md mb-2">
            <label className="block text-sm font-medium text-foreground">Selecione uma Clínica primeiro (Apenas visível para SMS Admin)</label>
            <select
              {...register('clinic_id')}
              className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
            >
              <option value="">Selecione...</option>
              {clinics?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.clinic_id && <p className="mt-1 text-sm text-destructive">{errors.clinic_id.message}</p>}
          </div>
        )}

        {/* hidden input if not admin */}
        {userRole !== 'SMS_ADMIN' && (
          <input type="hidden" {...register('clinic_id')} />
        )}

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Paciente *</label>
          <select
            {...register('patient_id')}
            disabled={userRole === 'SMS_ADMIN' && !selectedClinicId}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background disabled:bg-muted disabled:opacity-50"
          >
            <option value="">Selecione um paciente...</option>
            {filteredPatients.length > 0 ? (
              filteredPatients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            ) : (
              <option value="" disabled>
                {userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Aguardando seleção da clínica...' 
                  : 'Nenhum paciente encontrado para esta clínica'}
              </option>
            )}
          </select>
          {errors.patient_id && <p className="mt-1 text-sm text-destructive">{errors.patient_id.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Profissional *</label>
          <select
            {...register('professional_id')}
            disabled={userRole === 'SMS_ADMIN' && !selectedClinicId}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background disabled:bg-muted disabled:opacity-50"
          >
            <option value="">Selecione um profissional...</option>
            {filteredProfessionals.length > 0 ? (
              filteredProfessionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - {p.specialty}</option>
              ))
            ) : (
              <option value="" disabled>
                {userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Aguardando seleção da clínica...' 
                  : 'Nenhum profissional encontrado para esta clínica'}
              </option>
            )}
          </select>
          {errors.professional_id && <p className="mt-1 text-sm text-destructive">{errors.professional_id.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Procedimento *</label>
          <select
            {...register('procedure_id')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          >
            <option value="">Selecione um procedimento...</option>
            {procedures.length > 0 ? (
              procedures.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Padrão: R$ {p.valor_total})</option>
              ))
            ) : (
              <option value="" disabled>Nenhum procedimento cadastrado ou ativo</option>
            )}
            {procedures.length === 0 && (
              <option value="" disabled>Certifique-se de que há procedimentos cadastrados e ativos</option>
            )}
          </select>
          {errors.procedure_id && <p className="mt-1 text-sm text-destructive">{errors.procedure_id.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Data de Emissão da Guia *</label>
          <input
            type="date"
            {...register('attendance_date')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
          {errors.attendance_date && <p className="mt-1 text-sm text-destructive">{errors.attendance_date.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Nº da Autorização</label>
          <input
            type="text"
            {...register('auth_number')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Data da Autorização</label>
          <input
            type="date"
            {...register('authorization_date')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Qtd. Autorizada</label>
          <input
            type="number"
            {...register('authorized_quantity', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">CID (Cód. Doença)</label>
          <input
            type="text"
            {...register('cid')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Caráter de Atendimento</label>
          <input
            type="text"
            placeholder="Ex: Eletivo, Urgência..."
            {...register('attendance_character')}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Valor Total da Guia (R$) *</label>
          <input
            type="number"
            step="0.01"
            readOnly
            {...register('value_applied', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-muted cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Calculado automaticamente: (Sessões Realizadas: {sessions?.filter(s => s.status === 'Realizada').length || 0}) x Valor do Procedimento
          </p>
          {errors.value_applied && <p className="mt-1 text-sm text-destructive">{errors.value_applied.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground">Anotações</label>
          <textarea
            {...register('notes')}
            rows={3}
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm px-3 py-2 border bg-background"
          />
        </div>
      </div>

      {/* SESSÕES */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Sessões (Frequência)</h3>
          <button
            type="button"
            disabled={sessionFields.length >= authorizedQuantity}
            onClick={() => append({ session_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '09:00', status: 'Realizada' })}
            className="rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sessionFields.length >= authorizedQuantity ? 'Limite Atingido' : '+ Adicionar Sessão'}
          </button>
        </div>
        
        {sessionFields.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma sessão adicionada. Clique acima para registrar as presenças.</p>
        )}

        <div className="space-y-4">
          {sessionFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end p-4 border rounded-md relative text-foreground">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-foreground mb-1">Data</label>
                <input
                  type="date"
                  {...register(`sessions.${index}.session_date` as const)}
                  className="block w-full rounded-md border-input shadow-sm py-1.5 px-3 text-sm border bg-background"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-foreground mb-1">Início</label>
                <input
                  type="time"
                  {...register(`sessions.${index}.start_time` as const)}
                  className="block w-full rounded-md border-input shadow-sm py-1.5 px-3 text-sm border bg-background"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-foreground mb-1">Fim</label>
                <input
                  type="time"
                  {...register(`sessions.${index}.end_time` as const)}
                  className="block w-full rounded-md border-input shadow-sm py-1.5 px-3 text-sm border bg-background"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                <select
                  {...register(`sessions.${index}.status` as const)}
                  className="block w-full rounded-md border-input shadow-sm py-1.5 px-3 text-sm border bg-background"
                >
                  <option value="Realizada">Realizada</option>
                  <option value="Falta do Paciente">Falta do Paciente</option>
                  <option value="Falta do Profissional">Falta do Profissional</option>
                  <option value="Feriado">Feriado</option>
                  <option value="Atestado Médico">Atestado Médico</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex justify-end sm:justify-start">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:text-red-700 text-xs font-medium py-1.5"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
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
