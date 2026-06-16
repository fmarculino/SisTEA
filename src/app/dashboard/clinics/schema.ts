import { z } from 'zod'
import { validateCNPJ } from '@/lib/validation-utils'

export const clinicSchema = z.object({
  name: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cnpj: z.string()
    .min(1, 'CNPJ é obrigatório')
    .refine((val) => validateCNPJ(val), {
      message: 'CNPJ inválido',
    }),
  cnes: z.string().optional().nullable(),
  corporate_name: z.string().min(1, 'Razão Social é obrigatória'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  active: z.boolean().default(true),
  competence_end_day: z.coerce.number().min(1).max(31).default(31),
  competence_deadline_day: z.coerce.number().min(1).max(31).default(5),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  orgao_emissor: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  parent_clinic_id: z.string().uuid().optional().nullable(),
}).refine((data) => {
  // Se é filial (tem parent_clinic_id), CNES é opcional (herda da matriz)
  // Se é matriz (sem parent_clinic_id), CNES é obrigatório
  if (!data.parent_clinic_id && !data.cnes) {
    return false
  }
  return true
}, {
  message: 'CNES é obrigatório para clínicas matrizes',
  path: ['cnes'],
})

export type ClinicFormData = z.infer<typeof clinicSchema>

