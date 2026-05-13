'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { professionalSchema, type ProfessionalFormData } from './schema'
import { createProfessionalAction, updateProfessionalAction } from './actions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusModal } from '@/components/ui/StatusModal'
import { User, CreditCard, Mail, Building, Briefcase, ChevronDown, CheckCircle, Smartphone, FileText } from 'lucide-react'

type ClinicOption = { id: string; name: string }
type SpecialtyOption = { id: string; name: string; cbo: string }

export function ProfessionalForm({ 
  initialData, 
  id, 
  clinics, 
  specialties,
  userRole, 
  userClinicId 
}: { 
  initialData?: Partial<ProfessionalFormData>; 
  id?: string;
  clinics: ClinicOption[];
  specialties: SpecialtyOption[];
  userRole: string;
  userClinicId?: string | null;
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, setIsPending] = useState(false)

  // Funções de máscara aprimoradas (Live Masking)
  const maskCPF = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11)
    if (v.length <= 3) return v
    if (v.length <= 6) return v.replace(/(\d{3})(\d{0,3})/, '$1.$2')
    if (v.length <= 9) return v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
  }

  const maskCNS = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 15)
    if (v.length <= 3) return v
    if (v.length <= 7) return v.replace(/(\d{3})(\d{0,4})/, '$1.$2')
    if (v.length <= 11) return v.replace(/(\d{3})(\d{4})(\d{0,4})/, '$1.$2.$3')
    return v.replace(/(\d{3})(\d{4})(\d{4})(\d{0,4})/, '$1.$2.$3.$4')
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: initialData?.name || '',
      cpf: (initialData as any)?.cpf ? maskCPF((initialData as any).cpf) : '',
      document_type: initialData?.document_type || '',
      document_number: initialData?.document_number || '',
      cns: initialData?.cns ? maskCNS(initialData.cns) : '',
      specialty_ids: initialData?.specialty_ids || [],
      email: initialData?.email || '',
      active: initialData?.active ?? true,
      clinic_ids: initialData?.clinic_ids || (userClinicId ? [userClinicId] : []),
    },
  })

  const onSubmit = async (data: ProfessionalFormData) => {
    setIsPending(true)
    setErrorMsg('')

    try {
      let result
      if (id) {
        result = await updateProfessionalAction(id, data)
      } else {
        result = await createProfessionalAction(data)
      }

      if (result && result.error) {
        setErrorMsg(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  const SectionTitle = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center space-x-2 text-primary font-bold border-b border-primary/20 pb-2 mb-6">
      <Icon className="w-5 h-5" />
      <span className="uppercase text-xs tracking-wider">{title}</span>
    </div>
  )

  return (
    <>
      <StatusModal
        isOpen={!!errorMsg}
        onClose={() => setErrorMsg('')}
        title="Atenção"
        message={errorMsg}
        type="error"
      />
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12 max-w-4xl bg-card text-card-foreground p-10 rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-border/40 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Seção 1: Identificação Profissional */}
        <section className="space-y-8">
          <SectionTitle icon={User} title="Identificação do Profissional" />
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
            <div className="sm:col-span-6">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Nome Completo *</label>
              <input
                type="text"
                {...register('name')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                placeholder="Digite o nome completo"
              />
              {errors.name && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.name.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">CPF (Opcional)</label>
              <input
                type="text"
                {...register('cpf')}
                onChange={(e) => setValue('cpf', maskCPF(e.target.value))}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-mono transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                placeholder="000.000.000-00"
              />
              {errors.cpf && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.cpf.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">CNS (Cartão SUS) *</label>
              <input
                type="text"
                {...register('cns')}
                onChange={(e) => setValue('cns', maskCNS(e.target.value))}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-mono transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                placeholder="000.0000.0000.0000"
              />
              {errors.cns && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.cns.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Tipo Documento (CRP, CRM, etc)</label>
              <input
                type="text"
                {...register('document_type')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                placeholder="Ex: CRM"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Número do Documento</label>
              <input
                type="text"
                {...register('document_number')}
                className="block w-full rounded-2xl border-border/60 bg-background/50 px-5 py-3.5 text-sm font-mono transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                placeholder="00000"
              />
            </div>
          </div>
        </section>

        {/* Seção 2: Atuação e Contato */}
        <section className="space-y-8">
          <SectionTitle icon={Briefcase} title="Atuação e Especialidades" />
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
            <div className="sm:col-span-6">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Especialidades / Funções *</label>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-6 border rounded-[2rem] bg-background/50 backdrop-blur-sm border-dashed border-border/60">
                {specialties.map((s) => (
                  <label key={s.id} className="flex items-center space-x-3 text-sm cursor-pointer hover:bg-primary/5 p-3 rounded-xl transition-all group border border-transparent hover:border-primary/10">
                    <input
                      type="checkbox"
                      value={s.id}
                      {...register('specialty_ids')}
                      className="w-5 h-5 rounded-lg border-border/60 text-primary focus:ring-primary/10 bg-background transition-all"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">CBO: {s.cbo}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.specialty_ids && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.specialty_ids.message}</p>}
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">E-mail de Contato</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  {...register('email')}
                  className="block w-full rounded-2xl border-border/60 bg-background/50 pl-12 pr-5 py-3.5 text-sm font-medium transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary border hover:border-primary/40 focus:bg-background shadow-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
              {errors.email && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.email.message}</p>}
            </div>
          </div>
        </section>

        {/* Seção 3: Vínculos e Status */}
        <section className="space-y-8">
          <SectionTitle icon={Building} title="Clínicas e Vínculos" />
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-6 pl-2">
            <div className="sm:col-span-6">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Unidades Vinculadas *</label>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 border rounded-[2rem] bg-background/50 backdrop-blur-sm border-dashed border-border/60">
                {clinics.map((c) => (
                  <label key={c.id} className={`flex items-center space-x-3 text-sm p-4 rounded-xl transition-all group border ${
                    userRole !== 'SMS_ADMIN' && c.id !== userClinicId 
                      ? 'opacity-50 cursor-not-allowed bg-muted/20 grayscale' 
                      : 'cursor-pointer hover:bg-primary/5 hover:border-primary/10'
                  }`}>
                    <input
                      type="checkbox"
                      value={c.id}
                      {...register('clinic_ids')}
                      disabled={userRole !== 'SMS_ADMIN' && c.id !== userClinicId}
                      className="w-5 h-5 rounded-lg border-border/60 text-primary focus:ring-primary/10 bg-background transition-all"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors uppercase tracking-widest">{c.name}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.clinic_ids && <p className="mt-2 text-xs text-rose-500 font-bold tracking-tight">{errors.clinic_ids.message}</p>}
              {userRole !== 'SMS_ADMIN' && (
                <p className="mt-3 text-[10px] text-muted-foreground italic font-medium px-2">
                  Como usuário de clínica, você só pode gerenciar o vínculo com sua própria unidade.
                </p>
              )}
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-center justify-between p-6 rounded-3xl border border-primary/20 bg-primary/[0.03] shadow-lg shadow-primary/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-widest text-foreground">Status do Profissional</span>
                    <p className="text-xs text-muted-foreground font-medium">
                      Define se o profissional está habilitado para realizar atendimentos no sistema.
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setValue('active', !watch('active'))}
                  className="relative inline-flex items-center cursor-pointer scale-125 transition-transform active:scale-110"
                >
                  <div className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${watch('active') ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 ease-in-out ${watch('active') ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </button>
                <input type="hidden" {...register('active')} />
              </div>
            </div>
          </div>
        </section>

        {/* Rodapé: Ações */}
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
    </>
  )
}
