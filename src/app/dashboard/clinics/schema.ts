import { z } from 'zod'

export const clinicSchema = z.object({
  name: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cnpj: z.string().optional().nullable(),
  cnes: z.string().optional().nullable(),
  corporate_name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  active: z.boolean().default(true),
})

export type ClinicFormData = z.infer<typeof clinicSchema>
