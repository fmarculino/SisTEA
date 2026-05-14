'use client'

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { attendanceSchema, type AttendanceFormData } from './schema'
import { createAttendanceAction, updateAttendanceAction } from './actions'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { generateFrequencyPDF } from '@/utils/generateFrequencyPDF'
import { QRCodeModal } from './QRCodeModal'
import { StatusModal } from '@/components/ui/StatusModal'
import { Plus, Trash2, Printer, QrCode, Search, AlertCircle, ShieldCheck } from 'lucide-react'

export function AttendanceForm({ 
  initialData, 
  id,
  patients,
  professionals,
  procedures,
  userClinicId,
  userRole,
  clinics,
  systemTimezone,
  competenceStatus
}: { 
  initialData?: Partial<AttendanceFormData>; 
  id?: string;
  patients: any[];
  professionals: any[];
  procedures: any[];
  userClinicId?: string | null;
  userRole: string;
  clinics?: any[];
  systemTimezone: string;
  competenceStatus?: string;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [qrModalSession, setQrModalSession] = useState<{ index: number; sessionId: string } | null>(null)

  const defaultClinicId = userRole === 'SMS_ADMIN' 
    ? (initialData?.clinic_id || '') 
    : (userClinicId || '')

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema) as any,
    defaultValues: {
      patient_id: initialData?.patient_id || '',
      professional_id: initialData?.professional_id || '',
      procedure_id: initialData?.procedure_id || '',
      clinic_id: defaultClinicId,
      attendance_date: initialData?.attendance_date || new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(new Date()),
      auth_number: initialData?.auth_number || '',
      authorization_date: initialData?.authorization_date || '',
      authorized_quantity: initialData?.authorized_quantity || 20,
      cid: initialData?.cid || '',
      attendance_character: initialData?.attendance_character || '01',
      quantity: initialData?.quantity ?? 1,
      value_applied: initialData?.value_applied || 0,
      professional_cbo: initialData?.professional_cbo || '',
      notes: initialData?.notes || '',
      sessions: initialData?.sessions || [],
    },
  })

  // Sync form when initialData changes (after redirect/revalidate)
  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        clinic_id: defaultClinicId,
        attendance_date: initialData.attendance_date || new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(new Date()),
      });
    }
  }, [initialData, reset, defaultClinicId]);

  const { fields: sessionFields, append, remove } = useFieldArray({
    control,
    name: 'sessions',
  })

  // Watch for procedure_id and professional_id
  const selectedProcedureId = watch('procedure_id')
  const selectedProfessionalId = watch('professional_id')
  const authorizedQuantity = watch('authorized_quantity')
  const sessions = watch('sessions') || []
  const hasValidatedSession = sessions.some(s => s.status === 'Realizada' || s.status === 'Glosado');
  const isCompetenceLocked = competenceStatus === 'FECHADA' || competenceStatus === 'ENVIADA_MS';
  const isHeaderLocked = isCompetenceLocked || (userRole === 'CLINIC_USER' && hasValidatedSession);

  // Filter procedures based on professional specialties
  const filteredProcedures = selectedProfessionalId 
    ? procedures.filter(proc => {
        const professional = professionals.find(p => p.id === selectedProfessionalId)
        if (!professional || !professional.specialty_ids) return false
        
        // Se o procedimento não tem especialidades vinculadas, mostramos para todos (regra de segurança)
        if (!proc.specialty_ids || proc.specialty_ids.length === 0) return true

        // Verifica se há interseção entre as especialidades do profissional e as do procedimento
        return proc.specialty_ids.some((id: string) => professional.specialty_ids.includes(id))
      })
    : []

  // Reset procedure if professional changes and current procedure is not in filtered list
  useEffect(() => {
    if (selectedProcedureId && selectedProfessionalId) {
      const isValid = filteredProcedures.some(p => p.id === selectedProcedureId)
      if (!isValid) {
        setValue('procedure_id', '')
        setValue('value_applied', 0)
      }
    }
  }, [selectedProfessionalId, filteredProcedures, selectedProcedureId, setValue])

  // Calculate value and quantity based on realized sessions
  useEffect(() => {
    if (sessions) {
      const realizedCount = sessions.filter(s => s.status === 'Realizada').length
      setValue('quantity', realizedCount, { shouldValidate: true })

      if (selectedProcedureId) {
        const proc = procedures.find((p) => p.id === selectedProcedureId)
        if (proc) {
          const totalValue = realizedCount * Number(proc.valor_total || 0)
          setValue('value_applied', totalValue)
        }
      }
    }
  }, [selectedProcedureId, sessions, procedures, setValue])

  // AUTO-POPULATE CBO based on Procedure Specialty Intersection
  useEffect(() => {
    if (selectedProcedureId && selectedProfessionalId) {
      const professional = professionals.find(p => p.id === selectedProfessionalId)
      const procedure = procedures.find(p => p.id === selectedProcedureId)
      
      if (professional && procedure) {
        // Find the specialty that both share
        // A procedure can belong to multiple specialties, but usually one matches the professional
        const commonSpecialtyId = procedure.specialty_ids?.find((id: string) => 
          professional.specialty_ids?.includes(id)
        )
        
        if (commonSpecialtyId) {
          // Find the CBO for this specialty from the professional's data
          const specialtyInfo = professional.specialties_full?.find((s: any) => s.id === commonSpecialtyId)
          if (specialtyInfo?.cbo) {
            setValue('professional_cbo', specialtyInfo.cbo, { shouldDirty: true })
          }
        }
      }
    }
  }, [selectedProcedureId, selectedProfessionalId, professionals, procedures, setValue])

  const onSubmit = async (data: AttendanceFormData) => {
    setIsPending(true)
    setErrorMsg('')

    const result = id 
      ? await updateAttendanceAction(id, data)
      : await createAttendanceAction(data)

    if (result && 'error' in result) {
      setErrorMsg(result.error as string)
      setIsPending(false)
    } else {
      // Success!
      router.refresh()
      if (!id && result && 'id' in result) {
        router.push(`/dashboard/attendances/${result.id}/edit`)
      } else {
        setIsPending(false)
      }
    }
  }

  // Debug: Log validation errors to console
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("Validation Errors:", errors);
    }
  }, [errors]);

  // Filter patients and professionals by selected clinic if SMS_ADMIN
  const selectedClinicId = watch('clinic_id')
  const filteredPatients = userRole === 'SMS_ADMIN' && selectedClinicId
    ? patients.filter(p => 
        p.clinic_id === selectedClinicId || 
        (p.patient_clinics && p.patient_clinics.some((pc: any) => pc.clinic_id === selectedClinicId))
      )
    : patients
  
  const filteredProfessionals = userRole === 'SMS_ADMIN' && selectedClinicId
    ? professionals.filter(p => 
        p.professional_clinics?.some((pc: any) => pc.clinic_id === selectedClinicId)
      )
    : professionals

  const calculateEndTime = (startTime: string, minutesToAdd: number) => {
    if (!startTime) return ''
    const [hours, minutes] = startTime.split(':').map(Number)
    const date = new Date()
    date.setHours(hours)
    date.setMinutes(minutes + minutesToAdd)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const handlePrint = async () => {
    const formData = getValues();
    const clinic = clinics?.find(c => c.id === formData.clinic_id);
    
    // Preferimos os dados que vieram do servidor via join no initialData para evitar problemas de filtro
    const isInitialPatient = (initialData as any)?.patient?.id === formData.patient_id;
    const isInitialProfessional = (initialData as any)?.professional_data?.id === formData.professional_id;

    let patient = isInitialPatient 
      ? (initialData as any).patient 
      : patients.find(p => p.id === formData.patient_id);
      
    let professional = isInitialProfessional 
      ? (initialData as any).professional_data 
      : professionals.find(p => p.id === formData.professional_id);

    const procedure = procedures.find(p => p.id === formData.procedure_id);

    const fullData = {
      ...formData,
      clinic_name: clinic?.name || 'COMUNICARE CENTRO MULTIDISCIPLINAR DE SERVIÇOS DE SAÚDE',
      cnes: clinic?.cnes || '4352440',
      professional_name: professional?.name,
      professional_cns: professional?.cns,
      professional_cbo: professional?.cbo,
      patient_name: patient?.name,
      patient_cns: patient?.cns_patient,
      patient_birthdate: patient?.birth_date,
      patient_gender: patient?.gender,
      patient_mother: patient?.mother_name,
      patient_phone: patient?.phone,
      patient_race_color: patient?.race_color,
      patient_address: patient?.address ? `${patient.address}` : '',
      patient_cep: patient?.cep,
      patient_city: patient?.city,
      procedure_code: procedure?.code,
    };

    try {
      await generateFrequencyPDF(fullData);
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      setErrorMsg('Erro ao gerar PDF da ficha de frequência.');
    }
  }

  const handlePrintDigital = () => {
    const formData = getValues();
    const clinic = clinics?.find(c => c.id === formData.clinic_id);
    
    // Preferimos os dados que vieram do servidor via join no initialData para evitar problemas de filtro
    const isInitialPatient = (initialData as any)?.patient?.id === formData.patient_id;
    const isInitialProfessional = (initialData as any)?.professional_data?.id === formData.professional_id;

    let patient = isInitialPatient 
      ? (initialData as any).patient 
      : patients.find(p => p.id === formData.patient_id);
      
    let professional = isInitialProfessional 
      ? (initialData as any).professional_data 
      : professionals.find(p => p.id === formData.professional_id);

    const isInitialProcedure = (initialData as any)?.procedure?.id === formData.procedure_id;
    const procedure = isInitialProcedure
      ? (initialData as any).procedure
      : procedures.find(p => p.id === formData.procedure_id);

    const fullData = {
      ...formData,
      clinic_name: clinic?.name || 'COMUNICARE CENTRO MULTIDISCIPLINAR DE SERVIÇOS DE SAÚDE',
      cnes: clinic?.cnes || '4352440',
      professional_name: professional?.name,
      professional_cns: professional?.cns,
      professional_cbo: professional?.cbo,
      patient_name: patient?.name,
      patient_cns: patient?.cns_patient,
      patient_birthdate: patient?.birth_date,
      patient_gender: patient?.gender,
      patient_mother: patient?.mother_name,
      patient_phone: patient?.phone,
      patient_race_color: patient?.race_color,
      patient_address: patient?.address ? `${patient.address}` : '',
      patient_cep: patient?.cep,
      patient_city: patient?.city,
      procedure_code: procedure?.code,
    };

    localStorage.setItem('print_frequency_data', JSON.stringify(fullData));
    window.open('/imprimir/frequencia', '_blank');
  };

  return (
    <>
      <StatusModal
        isOpen={!!errorMsg}
        onClose={() => setErrorMsg('')}
        title="Operação Negada"
        message={errorMsg}
        type="error"
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-4xl bg-card text-card-foreground p-8 rounded-2xl shadow-xl border border-border/40 mb-10">

      {(competenceStatus === 'FECHADA' || competenceStatus === 'ENVIADA_MS') && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <div className="shrink-0 mt-0.5 text-rose-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-600 uppercase tracking-widest mb-1">
              {competenceStatus === 'ENVIADA_MS' ? 'Competência com Hard Lock' : 'Competência Encerrada'}
            </h4>
            <p className="text-xs text-rose-500/80 font-medium leading-relaxed">
              {competenceStatus === 'ENVIADA_MS' 
                ? 'Este atendimento pertence a uma competência que já foi processada e enviada ao Ministério da Saúde. Nenhuma alteração é possível sob qualquer circunstância.' 
                : 'Este atendimento pertence a uma competência que já foi fechada. Para modificá-lo, a competência deve ser reaberta pelo administrador do sistema.'}
            </p>
          </div>
        </div>
      )}

      {/* Validation Errors Debug List */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm mb-4">
          <p className="font-bold mb-2 uppercase tracking-tight text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Campos com erro de preenchimento:
          </p>
          <ul className="list-disc list-inside space-y-1 opacity-90 text-[13px]">
            {Object.entries(errors).map(([key, error]: [string, any]) => {
              if (key === 'sessions' && Array.isArray(error)) {
                return error.map((sessionErr: any, index: number) => {
                  if (!sessionErr) return null;
                  return Object.entries(sessionErr).map(([subKey, subErr]: [string, any]) => (
                    <li key={`${key}.${index}.${subKey}`}>
                      Sessão {index + 1}: <span className="font-semibold">{subKey}</span> — {subErr.message || 'Valor inválido'}
                    </li>
                  ));
                });
              }
              return (
                <li key={key}>
                  <span className="font-semibold">{key}:</span> {error.message || (error.root?.message) || 'Valor inválido'}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {userRole === 'SMS_ADMIN' && (
          <div className="sm:col-span-2 bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10 mb-2">
            <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Unidade de Saúde (Clínica)</label>
            <select
              {...register('clinic_id')}
              disabled={isHeaderLocked}
              className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background/50 transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
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
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <SearchableSelect
                options={filteredPatients}
                value={field.value}
                onChange={field.onChange}
                disabled={isHeaderLocked || (userRole === 'SMS_ADMIN' && !selectedClinicId)}
                placeholder={userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Selecione a clínica primeiro' 
                  : 'Selecione um paciente...'}
                className="mt-1"
              />
            )}
          />
          {errors.patient_id && <p className="mt-1 text-sm text-rose-500">{errors.patient_id.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Profissional de Saúde *</label>
          <Controller
            control={control}
            name="professional_id"
            render={({ field }) => (
              <SearchableSelect
                options={filteredProfessionals.map(p => ({
                  id: p.id,
                  name: `${p.name} — ${p.specialty}`
                }))}
                value={field.value}
                onChange={field.onChange}
                disabled={isHeaderLocked || (userRole === 'SMS_ADMIN' && !selectedClinicId)}
                placeholder={userRole === 'SMS_ADMIN' && !selectedClinicId 
                  ? 'Selecione a clínica primeiro' 
                  : 'Selecione um profissional...'}
                className="mt-1"
              />
            )}
          />
          {errors.professional_id && <p className="mt-1 text-sm text-rose-500">{errors.professional_id.message}</p>}
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Procedimento / Serviço *</label>
          <Controller
            control={control}
            name="procedure_id"
            render={({ field }) => (
              <SearchableSelect
                options={filteredProcedures.map(p => ({
                  id: p.id,
                  code: p.code,
                  name: `${p.code ? p.code + ' — ' : ''}${p.name} (Valor: ${formatCurrency(p.valor_total)} / sessão)`
                }))}
                value={field.value}
                onChange={field.onChange}
                disabled={isHeaderLocked || !selectedProfessionalId}
                placeholder={!selectedProfessionalId ? "Selecione primeiro o profissional..." : "Escolha o procedimento..."}
                className="mt-1"
              />
            )}
          />
          {errors.procedure_id && <p className="mt-1 text-sm text-rose-500">{errors.procedure_id.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">CBO de Atuação (Automático)</label>
          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
            <input
              {...register('professional_cbo')}
              readOnly
              className="mt-1 block w-full rounded-xl border-border/60 shadow-sm sm:text-sm pl-10 pr-4 py-2 border bg-muted/30 font-bold text-foreground cursor-not-allowed transition-all"
              placeholder="CBO Automático..."
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">O CBO é identificado automaticamente com base no procedimento e profissional.</p>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Data da Guia/Atendimento *</label>
          <input
            type="date"
            {...register('attendance_date')}
            readOnly={isHeaderLocked}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          />
          {errors.attendance_date && <p className="mt-1 text-sm text-rose-500">{errors.attendance_date.message}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Nº de Autorização (Guia)</label>
          <input
            type="text"
            placeholder="Ex: 12345678"
            {...register('auth_number')}
            readOnly={isHeaderLocked}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Data de Autorização</label>
          <input
            type="date"
            {...register('authorization_date')}
            readOnly={isHeaderLocked}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Qtd. Autorizada</label>
          <input
            type="number"
            {...register('authorized_quantity', { valueAsNumber: true })}
            readOnly={isHeaderLocked}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">CID principal</label>
          <input
            type="text"
            placeholder="Ex: F84.0"
            {...register('cid')}
            readOnly={isHeaderLocked}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Caráter de Atendimento</label>
          <select
             {...register('attendance_character')}
             disabled={isHeaderLocked}
             className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2.5 border bg-background transition-all ${isHeaderLocked ? 'cursor-not-allowed opacity-70 bg-muted' : ''}`}
          >
            <option value="01">01 - Eletivo</option>
            <option value="02">02 - Urgência</option>
            <option value="03">03 - Acidente no local de trabalho</option>
            <option value="04">04 - Acidente no trajeto do trabalho</option>
            <option value="05">05 - Outros tipos de acidente de trânsito</option>
            <option value="06">06 - Outros tipos de lesões/envenenamentos</option>
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Qtd. Produzida (BPA)</label>
          <input
            type="number"
            {...register('quantity', { valueAsNumber: true })}
            readOnly={true}
            className={`mt-1 block w-full rounded-xl border-border/60 shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm px-4 py-2 border bg-muted cursor-not-allowed opacity-70 transition-all`}
            title="Calculado automaticamente com base nas sessões realizadas"
          />
        </div>

        <div className="sm:col-span-2 bg-primary/5 dark:bg-primary/10 p-6 rounded-2xl border border-primary/10 dark:border-primary/20">
          <label className="block text-xs font-bold text-primary dark:text-primary/90 uppercase tracking-widest mb-1">Valor Total Estimado (R$)</label>
          <div className="flex items-center gap-4">
            <div className="mt-1 block w-full max-w-[200px] rounded-xl border-transparent shadow-sm sm:text-lg font-bold px-4 py-2.5 bg-background dark:bg-muted/50 text-primary dark:text-primary min-h-[46px] flex items-center">
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
            disabled={sessionFields.length >= authorizedQuantity || isCompetenceLocked}
            onClick={() => append({ session_date: new Intl.DateTimeFormat('en-CA', { timeZone: systemTimezone }).format(new Date()), start_time: '08:00', end_time: '08:50', status: userRole === 'CLINIC_USER' ? 'Pendente' : 'Realizada' })}
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
                  readOnly={isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))}
                  className={`block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all ${
                    (isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))) ? 'opacity-70 bg-muted cursor-not-allowed' : ''
                  }`}
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
                  readOnly={isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))}
                  className={`block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all ${
                    (isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))) ? 'opacity-70 bg-muted cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Fim</label>
                <input
                  type="time"
                  {...register(`sessions.${index}.end_time` as const)}
                  readOnly={isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))}
                  className={`block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all ${
                    (isCompetenceLocked || (userRole !== 'SMS_ADMIN' && (watch(`sessions.${index}.status`) === 'Realizada' || watch(`sessions.${index}.status`) === 'Glosado'))) ? 'opacity-70 bg-muted cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Situação</label>
                {userRole === 'SMS_ADMIN' ? (
                  <div className="relative group/audit">
                    <select
                      {...register(`sessions.${index}.status` as const)}
                      disabled={isCompetenceLocked}
                      className={`block w-full rounded-lg border-border/60 shadow-sm py-2 px-3 text-sm border bg-background focus:ring-primary/10 focus:border-primary transition-all ${
                        watch(`sessions.${index}.status`) === 'Glosado' ? 'text-rose-600 dark:text-rose-400 font-bold border-rose-500 dark:border-rose-500/50 bg-rose-50/50 dark:bg-rose-500/10' : 
                        watch(`sessions.${index}.status`) === 'Pendente' ? 'text-amber-600 dark:text-amber-400 font-bold border-amber-500 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10' :
                        watch(`sessions.${index}.status`) === 'Realizada' ? 'text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10' : ''
                      }`}
                    >
                      <option value="Realizada">Realizada</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Glosado" className="text-rose-600 font-bold">Glosado</option>
                    </select>
                    
                    {/* Audit Info Badge for SMS_ADMIN */}
                    {watch(`sessions.${index}.status` as any) === 'Realizada' && watch(`sessions.${index}.validated_at` as any) && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg cursor-help group/tooltip">
                          <ShieldCheck className="h-3 w-3" />
                          
                          {/* Tooltip Content */}
                          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-[10px] rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-auto border border-white/10 backdrop-blur-md z-[100]">
                            <p className="font-bold border-b border-white/10 pb-1 mb-1 text-emerald-400 uppercase tracking-widest">Auditoria de Assinatura</p>
                            <div className="space-y-1">
                              <p><span className="opacity-50">Data/Hora:</span> {new Date(watch(`sessions.${index}.validated_at` as any)!).toLocaleString('pt-BR')}</p>
                              <p><span className="opacity-50">IP:</span> {watch(`sessions.${index}.validation_ip` as any)}</p>
                              <p className="truncate"><span className="opacity-50">Dispositivo:</span> {watch(`sessions.${index}.validation_ua` as any)}</p>
                              {watch(`sessions.${index}.validation_geo` as any) && (
                                <div className="space-y-0.5 border-t border-white/10 pt-1 mt-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sky-400 font-medium">
                                      📍 Localização: {(watch(`sessions.${index}.validation_geo` as any) as any).lat.toFixed(4)}, {(watch(`sessions.${index}.validation_geo` as any) as any).lng.toFixed(4)}
                                    </p>
                                  </div>
                                  {watch(`sessions.${index}.validation_distance` as any) !== undefined && watch(`sessions.${index}.validation_distance` as any) !== null && (
                                    <p className={`font-bold ${watch(`sessions.${index}.is_out_of_range` as any) ? 'text-amber-400' : 'text-emerald-400/80'}`}>
                                      📏 Distância: {Math.round(watch(`sessions.${index}.validation_distance` as any) as number)}m da clínica
                                      {watch(`sessions.${index}.is_out_of_range` as any) && ' ⚠️ ASSINATURA REMOTA'}
                                    </p>
                                  )}
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${(watch(`sessions.${index}.validation_geo` as any) as any).lat},${(watch(`sessions.${index}.validation_geo` as any) as any).lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 flex items-center justify-center gap-1.5 w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-1.5 rounded-lg border border-emerald-500/30 transition-all font-bold uppercase tracking-tighter"
                                  >
                                    🗺️ Ver no Google Maps
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input type="hidden" {...register(`sessions.${index}.status` as const)} />
                    <div className={`block w-full rounded-lg shadow-sm py-2 px-3 text-sm border font-bold text-center ${
                      watch(`sessions.${index}.status` as any) === 'Glosado' ? 'text-rose-600 dark:text-rose-400 border-rose-500 dark:border-rose-500/50 bg-rose-50/50 dark:bg-rose-500/10' : 
                      watch(`sessions.${index}.status` as any) === 'Pendente' ? 'text-amber-600 dark:text-amber-400 border-amber-500 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10' :
                      watch(`sessions.${index}.status` as any) === 'Realizada' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500 dark:border-emerald-500/50 bg-amber-50/50 dark:bg-emerald-500/10' : 'border-border/60 bg-background'
                    }`}>
                      {watch(`sessions.${index}.status` as any) === 'Realizada' ? '✓ Realizada' : 
                       watch(`sessions.${index}.status` as any) === 'Pendente' ? '⏳ Pendente' : 
                       watch(`sessions.${index}.status` as any) === 'Glosado' ? '✗ Glosado' : watch(`sessions.${index}.status` as any)}
                    </div>
                  </>
                )}
              </div>
              
              {(watch(`sessions.${index}.status` as any) === 'Glosado' || watch(`sessions.${index}.status` as any) === 'Pendente') && (
                <div className={`sm:col-span-4 mt-2 sm:mt-0 transition-all animate-in fade-in slide-in-from-left-2`}>
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ml-1 opacity-80 ${
                    watch(`sessions.${index}.status` as any) === 'Glosado' ? 'text-rose-500' : 'text-amber-600'
                  }`}>
                    {watch(`sessions.${index}.status` as any) === 'Glosado' ? 'Motivo da Glosa' : 'Motivo da Pendência'}
                  </label>
                  <input
                    {...register(`sessions.${index}.justification` as any)}
                    readOnly={isCompetenceLocked}
                    className={`block w-full rounded-lg shadow-sm sm:text-xs px-3 py-2 border transition-all ${
                      watch(`sessions.${index}.status` as any) === 'Glosado' 
                        ? 'border-rose-200 dark:border-rose-900/50 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-500/5' 
                        : 'border-amber-200 dark:border-amber-900/50 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-500/5'
                    }`}
                    placeholder={watch(`sessions.${index}.status` as any) === 'Glosado' ? "Descreva o motivo da glosa..." : "Descreva o motivo da pendência..."}
                  />
                </div>
              )}

              {/* Action buttons area */}
              {watch(`sessions.${index}.status` as any) === 'Realizada' ? (
                <div className="sm:col-span-1 flex items-end justify-end">
                  {!isCompetenceLocked && (!watch(`sessions.${index}.id`) || (userRole === 'SMS_ADMIN' && !watch(`sessions.${index}.validated_at`))) && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-rose-500 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ) : (
                <div className="sm:col-span-1 flex flex-col items-end justify-center gap-2">
                   {userRole === 'CLINIC_USER' && watch(`sessions.${index}.status`) === 'Pendente' && id && watch(`sessions.${index}.id`) && !isCompetenceLocked && (
                    <button
                      type="button"
                      onClick={() => setQrModalSession({ index, sessionId: watch(`sessions.${index}.id`)! })}
                      className="text-primary hover:text-white hover:bg-primary p-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest w-full text-right"
                      title="Solicitar assinatura via QR Code"
                    >
                      📱 Assinar
                    </button>
                  )}
                  {!isCompetenceLocked && (
                    !watch(`sessions.${index}.id`) || 
                    (userRole === 'SMS_ADMIN' && !watch(`sessions.${index}.validated_at`)) ||
                    (userRole === 'CLINIC_USER' && watch(`sessions.${index}.status` as any) === 'Pendente' && !watch(`sessions.${index}.validated_at`))
                  ) && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-rose-500 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest w-full text-right"
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
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
        {id && (
          <div className="flex gap-2 mr-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 text-indigo-700 px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-600/20 transition-all active:scale-95"
              title="Formulário preenchido no PDF original do SUS"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              PDF Antigo
            </button>
            <button
              type="button"
              onClick={handlePrintDigital}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-600/20 transition-all active:scale-95"
              title="Nova versão digital aprimorada"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Imprimir Nova Versão Digital
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={isPending || isCompetenceLocked}
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

      {/* QR Code Modal for session validation */}
      {qrModalSession && id && (
        <QRCodeModal
          sessionId={qrModalSession.sessionId}
          sessionIndex={qrModalSession.index}
          attendanceId={id}
          patientName={patients.find(p => p.id === watch('patient_id'))?.name || 'Paciente'}
          sessionDate={watch(`sessions.${qrModalSession.index}.session_date`) || ''}
          onClose={() => setQrModalSession(null)}
        />
      )}
    </>
  )
}
