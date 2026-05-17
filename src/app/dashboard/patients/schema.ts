import { z } from 'zod'
import { validateCPF, validateCNS } from '@/utils/validation'

export const patientSchema = z.object({
  name: z.string().min(1, 'Nome do paciente é obrigatório'),
  birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
  cns_patient: z.string().min(1, 'CNS é obrigatório'),
  cpf: z.string().optional().nullable().or(z.literal('')),
  mother_name: z.string().optional().nullable(),
  gender: z.enum(['Masculino', 'Feminino', 'Outro', 'Não Informado']).default('Não Informado'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  ibge_code: z.string().optional().nullable(),
  nationality: z.string().default('010').optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  race_color: z.enum(['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não Informado']).default('Não Informado'),
  cep: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().length(2, 'UF deve ter 2 caracteres').optional().nullable(),
  medical_record_number: z.string().optional().nullable(),
  active: z.boolean().default(true),
  clinic_id: z.string().uuid().optional().nullable().or(z.literal('')),
  clinic_ids: z.array(z.string().uuid()).min(1, 'Pelo menos um vínculo com Clínica é obrigatório'),
}).refine((data) => {
  if (data.cpf && data.cpf.length > 0) {
    return validateCPF(data.cpf)
  }
  return true
}, {
  message: 'CPF inválido',
  path: ['cpf'],
}).refine((data) => {
  if (data.cns_patient && data.cns_patient.length > 0) {
    return validateCNS(data.cns_patient)
  }
  return true
}, {
  message: 'CNS inválido',
  path: ['cns_patient'],
})

export type PatientFormData = z.infer<typeof patientSchema>
