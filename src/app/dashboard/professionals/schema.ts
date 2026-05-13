import { z } from 'zod'
import { validateCPF, validateCNS } from '@/utils/validation'

export const professionalSchema = z.object({
  name: z.string().min(1, 'Nome do profissional é obrigatório'),
  cpf: z.string().trim().optional().nullable().or(z.literal('')),
  document_type: z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  specialty_ids: z.array(z.string().uuid()).min(1, 'Pelo menos uma especialidade deve ser selecionada'),
  cns: z.string().trim().min(1, 'CNS é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  active: z.boolean(),
  clinic_ids: z.array(z.string().uuid()).min(1, 'Pelo menos uma clínica deve ser selecionada'),
}).refine((data) => {
  if (data.cpf && data.cpf.length > 0) {
    return validateCPF(data.cpf)
  }
  return true
}, {
  message: 'CPF inválido',
  path: ['cpf'],
}).refine((data) => {
  if (data.cns && data.cns.length > 0) {
    return validateCNS(data.cns)
  }
  return true
}, {
  message: 'CNS inválido',
  path: ['cns'],
})

export type ProfessionalFormData = z.infer<typeof professionalSchema>
