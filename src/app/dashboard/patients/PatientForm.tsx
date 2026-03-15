'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientSchema, type PatientFormData } from './schema'
import { createPatientAction, updatePatientAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Phone, MapPin, Calendar, CreditCard, ChevronDown, CheckCircle } from 'lucide-react'

type ClinicOption = { id: string; name: string }

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Outro', 'Não Informado']
const RACE_OPTIONS = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não Informado']
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export function PatientForm({ 
  initialData, 
  id, 
  clinics, 
  userRole, 
  userClinicId 
}: { 
  initialData?: Partial<PatientFormData>; 
  id?: string;
  clinics: ClinicOption[];
  userRole: string;
  userClinicId?: string | null;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const defaultClinicId = userRole === 'SMS_ADMIN' 
    ? (initialData?.clinic_id || '') 
    : (userClinicId || '')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      birth_date: initialData?.birth_date || '',
      cns_patient: initialData?.cns_patient || '',
      mother_name: initialData?.mother_name || '',
      gender: (initialData?.gender as any) || 'Não Informado',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      race_color: (initialData?.race_color as any) || 'Não Informado',
      cep: initialData?.cep || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      medical_record_number: initialData?.medical_record_number || '',
      active: initialData?.active ?? true,
      clinic_id: defaultClinicId,
    },
  })

  // Funções simples de máscara
  const maskCNS = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1.$2.$3.$4').substring(0, 18)
  }

  const maskCEP = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2').substring(0, 9)
  }

  const maskPhone = (value: string) => {
    const v = value.replace(/\D/g, '')
    if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3').substring(0, 14)
    return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').substring(0, 15)
  }

  const onSubmit = async (data: PatientFormData) => {
    setIsPending(true)
    setErrorMsg('')

    let result
    if (id) {
      result = await updatePatientAction(id, data)
    } else {
      result = await createPatientAction(data)
    }

    if (result && result.error) {
      setErrorMsg(result.error)
      setIsPending(false)
    }
  }

  const SectionTitle = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center space-x-2 text-primary font-bold border-b border-primary/20 pb-2 mb-4">
      <Icon className="w-5 h-5" />
      <span className="uppercase text-xs tracking-wider">{title}</span>
    </div>
  )

    return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-12 max-w-4xl bg-card text-card-foreground p-10 rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-border/40 mb-12 translate-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-5 rounded-2xl text-sm font-medium animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            {errorMsg}
          </div>
        </div>
      )}

      {/* Seção 1: Identificação */}
      <section className="space-y-8">
        <SectionTitle icon={User} title="Identificação do Paciente" />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
          <div className="sm:col-span-4">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Nome Completo *</label>
            <input
              type="text"
              {...register('name')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="Digite o nome completo"
            />
            {errors.name && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.name.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">CNS (Cartão SUS) *</label>
            <input
              type="text"
              {...register('cns_patient')}
              onChange={(e) => setValue('cns_patient', maskCNS(e.target.value))}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-mono transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="000.0000.0000.0000"
            />
            {errors.cns_patient && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.cns_patient.message}</p>}
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Nome da Mãe</label>
            <input
              type="text"
              {...register('mother_name')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="Nome completo da mãe"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Nº Prontuário</label>
            <input
              type="text"
              {...register('medical_record_number')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="Ex: 12345"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Nascimento *</label>
            <input
              type="date"
              {...register('birth_date')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
            />
            {errors.birth_date && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.birth_date.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Sexo</label>
            <div className="relative group/select">
              <select
                {...register('gender')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-bold transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border appearance-none hover:border-primary/40 focus:bg-background pr-10 shadow-sm"
              >
                {GENDER_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none group-focus-within/select:text-primary transition-colors" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Raça/Cor</label>
            <div className="relative group/select">
              <select
                {...register('race_color')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-bold transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border appearance-none hover:border-primary/40 focus:bg-background pr-10 shadow-sm"
              >
                {RACE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none group-focus-within/select:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </section>

      {/* Seção 2: Contato e Endereço */}
      <section className="space-y-8 pt-4">
        <SectionTitle icon={MapPin} title="Contato e Endereço" />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
          <div className="sm:col-span-3">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Telefone</label>
            <input
              type="text"
              {...register('phone')}
              onChange={(e) => setValue('phone', maskPhone(e.target.value))}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">CEP</label>
            <input
              type="text"
              {...register('cep')}
              onChange={(e) => setValue('cep', maskCEP(e.target.value))}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-mono transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="00000-000"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Logradouro / Endereço</label>
            <input
              type="text"
              {...register('address')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="Rua, número, bairro..."
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Cidade</label>
            <input
              type="text"
              {...register('city')}
              className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
              placeholder="Cidade"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">UF</label>
            <div className="relative group/select">
              <select
                {...register('state')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-bold transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border appearance-none hover:border-primary/40 focus:bg-background pr-10 shadow-sm"
              >
                <option value="">UF</option>
                {UF_OPTIONS.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none group-focus-within/select:text-primary transition-colors" />
            </div>
            {errors.state && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.state.message}</p>}
          </div>
        </div>
      </section>

      {/* Seção 3: Configurações do Sistema */}
      <section className="space-y-8 pt-4">
        <SectionTitle icon={CreditCard} title="Configurações e Vínculo" />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
          {userRole === 'SMS_ADMIN' ? (
            <div className="sm:col-span-4">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Unidade/Clínica de Atendimento *</label>
              <div className="relative group/select">
                <select
                  {...register('clinic_id')}
                  className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-bold transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border appearance-none hover:border-primary/40 focus:bg-background pr-10 shadow-sm"
                >
                  <option value="">Selecione a clínica...</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none group-focus-within/select:text-primary transition-colors" />
              </div>
              {errors.clinic_id && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.clinic_id.message}</p>}
            </div>
          ) : (
            <input type="hidden" {...register('clinic_id')} />
          )}

          <div className={`flex items-end pb-1 ${userRole === 'SMS_ADMIN' ? 'sm:col-span-2' : 'sm:col-span-6'}`}>
            <label className="flex items-center space-x-4 bg-muted/30 p-4 rounded-[1.25rem] border border-border/40 w-full cursor-pointer hover:bg-muted/50 transition-all border-dashed hover:border-primary/30 group">
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('active')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border/60 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/10 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-foreground uppercase tracking-widest group-hover:text-primary transition-colors">Paciente Ativo</span>
                <p className="text-[10px] text-muted-foreground leading-tight font-medium">Permite agendamentos e atendimentos.</p>
              </div>
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-4 border-t border-border/30 pt-10 mt-12">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full sm:w-auto rounded-2xl border border-border bg-background px-8 py-3.5 text-sm font-black text-muted-foreground/70 shadow-sm hover:bg-muted hover:text-foreground transition-all active:scale-95 uppercase tracking-widest border-dashed hover:border-solid"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto inline-flex justify-center items-center rounded-2xl bg-primary px-12 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest group"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              PROCESSANDO...
            </span>
          ) : (
            <>
              {id ? 'Atualizar Cadastro' : 'Salvar Cadastro'}
              <CheckCircle className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}
