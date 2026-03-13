import { z } from 'zod'

export const professionalSchema = z.object({
  name: z.string().min(1, 'Nome do profissional é obrigatório'),
  cpf: z.string().optional().nullable().or(z.literal('')),
  document_type: z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  specialty_ids: z.array(z.string().uuid()).min(1, 'Pelo menos uma especialidade deve ser selecionada'),
  cns: z.string().min(1, 'CNS é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  active: z.boolean(),
  clinic_ids: z.array(z.string().uuid()).min(1, 'Pelo menos uma clínica deve ser selecionada'),
})

export type ProfessionalFormData = z.infer<typeof professionalSchema>
