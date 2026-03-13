import { z } from 'zod'
import { validateCNPJ } from '@/lib/validation-utils'

export const clinicSchema = z.object({
  name: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cnpj: z.string()
    .min(1, 'CNPJ é obrigatório')
    .refine((val) => validateCNPJ(val), {
      message: 'CNPJ inválido',
    }),
  cnes: z.string().min(1, 'CNES é obrigatório'),
  corporate_name: z.string().min(1, 'Razão Social é obrigatória'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  active: z.boolean().default(true),
})

export type ClinicFormData = z.infer<typeof clinicSchema>
