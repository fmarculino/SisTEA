'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientSchema, type PatientFormData } from './schema'
import { createPatientAction, updatePatientAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Phone, MapPin, Calendar, CreditCard, ChevronDown } from 'lucide-react'

type ClinicOption = { id: string; name: string }

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Outro', 'Não Informado']
const RACE_OPTIONS = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não Informado']
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export function PatientForm({ 
  intialData, 
  id, 
  clinics, 
  userRole, 
  userClinicId 
}: { 
  intialData?: Partial<PatientFormData>; 
  id?: string;
  clinics: ClinicOption[];
  userRole: string;
  userClinicId?: string | null;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  const defaultClinicId = userRole === 'SMS_ADMIN' 
    ? (intialData?.clinic_id || '') 
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
      name: intialData?.name || '',
      birth_date: intialData?.birth_date || '',
      cns_patient: intialData?.cns_patient || '',
      mother_name: intialData?.mother_name || '',
      gender: (intialData?.gender as any) || 'Não Informado',
      phone: intialData?.phone || '',
      address: intialData?.address || '',
      race_color: (intialData?.race_color as any) || 'Não Informado',
      cep: intialData?.cep || '',
      city: intialData?.city || '',
      state: intialData?.state || '',
      medical_record_number: intialData?.medical_record_number || '',
      active: intialData?.active ?? true,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-3xl bg-card text-card-foreground p-8 rounded-xl shadow-xl border border-border">
      {errorMsg && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm mb-4 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
          {errorMsg}
        </div>
      )}

      {/* Seção 1: Identificação */}
      <section>
        <SectionTitle icon={User} title="Identificação do Paciente" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label className="block text-sm font-semibold text-foreground mb-1">Nome Completo *</label>
            <input
              type="text"
              {...register('name')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="Digite o nome completo"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive font-medium">{errors.name.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">CNS (Cartão SUS) *</label>
            <input
              type="text"
              {...register('cns_patient')}
              onChange={(e) => setValue('cns_patient', maskCNS(e.target.value))}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="000.0000.0000.0000"
            />
            {errors.cns_patient && <p className="mt-1 text-xs text-destructive font-medium">{errors.cns_patient.message}</p>}
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm font-semibold text-foreground mb-1">Nome da Mãe</label>
            <input
              type="text"
              {...register('mother_name')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="Nome completo da mãe"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm font-semibold text-foreground mb-1">Nº Prontuário</label>
            <input
              type="text"
              {...register('medical_record_number')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="Ex: 12345"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">Data de Nascimento *</label>
            <div className="relative">
              <input
                type="date"
                {...register('birth_date')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              />
            </div>
            {errors.birth_date && <p className="mt-1 text-xs text-destructive font-medium">{errors.birth_date.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">Sexo</label>
            <select
              {...register('gender')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border appearance-none"
            >
              {GENDER_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">Raça/Cor</label>
            <select
              {...register('race_color')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border appearance-none"
            >
              {RACE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Seção 2: Contato e Endereço */}
      <section>
        <SectionTitle icon={MapPin} title="Contato e Endereço" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">Telefone</label>
            <input
              type="text"
              {...register('phone')}
              onChange={(e) => setValue('phone', maskPhone(e.target.value))}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground mb-1">CEP</label>
            <input
              type="text"
              {...register('cep')}
              onChange={(e) => setValue('cep', maskCEP(e.target.value))}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="00000-000"
            />
          </div>

          <div className="sm:col-span-2">
            {/* Espaço vazio ou campo extra se necessário */}
          </div>

          <div className="sm:col-span-4">
            <label className="block text-sm font-semibold text-foreground mb-1">Logradouro / Endereço</label>
            <input
              type="text"
              {...register('address')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="Rua, número, bairro..."
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-semibold text-foreground mb-1">Cidade</label>
            <input
              type="text"
              {...register('city')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              placeholder="Cidade"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm font-semibold text-foreground mb-1">UF</label>
            <select
              {...register('state')}
              className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border appearance-none"
            >
              <option value="">UF</option>
              {UF_OPTIONS.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            {errors.state && <p className="mt-1 text-xs text-destructive font-medium">{errors.state.message}</p>}
          </div>
        </div>
      </section>

      {/* Seção 3: Configurações do Sistema */}
      <section>
        <SectionTitle icon={CreditCard} title="Configurações e Vínculo" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
          {userRole === 'SMS_ADMIN' && (
            <div className="sm:col-span-4">
              <label className="block text-sm font-semibold text-foreground mb-1">Unidade/Clínica de Atendimento *</label>
              <select
                {...register('clinic_id')}
                className="block w-full rounded-lg border-input bg-background px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary border"
              >
                <option value="">Selecione a clínica...</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.clinic_id && <p className="mt-1 text-xs text-destructive font-medium">{errors.clinic_id.message}</p>}
            </div>
          )}

          {/* hidden input if not admin */}
          {userRole !== 'SMS_ADMIN' && (
            <input type="hidden" {...register('clinic_id')} />
          )}

          <div className="sm:col-span-2 flex items-end pb-2.5">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                {...register('active')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              <span className="ms-3 text-sm font-medium text-foreground group-hover:text-primary transition-colors">Paciente Ativo</span>
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end space-x-4 border-t border-border pt-6 mt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-input bg-background px-6 py-2.5 text-sm font-bold text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
        >
          DESCARTAR
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex justify-center rounded-lg border border-transparent bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95 translate-y-0 hover:-translate-y-0.5"
        >
          {isPending ? 'PROCESSANDO...' : 'SALVAR CADASTRO'}
        </button>
      </div>
    </form>
  )
}
