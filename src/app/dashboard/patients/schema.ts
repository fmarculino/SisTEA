import { z } from 'zod'

export const patientSchema = z.object({
  name: z.string().min(1, 'Nome do paciente é obrigatório'),
  birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
  cns_patient: z.string().min(15, 'CNS deve ter 15 dígitos').max(18), // 000.0000.0000.0000 ou 15 dígitos
  mother_name: z.string().optional().nullable(),
  gender: z.enum(['Masculino', 'Feminino', 'Outro', 'Não Informado']).default('Não Informado'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  race_color: z.enum(['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não Informado']).default('Não Informado'),
  cep: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().length(2, 'UF deve ter 2 caracteres').optional().nullable(),
  medical_record_number: z.string().optional().nullable(),
  active: z.boolean().default(true),
  clinic_id: z.string().uuid('Vínculo com Clínica é obrigatório'),
})

export type PatientFormData = z.infer<typeof patientSchema>
