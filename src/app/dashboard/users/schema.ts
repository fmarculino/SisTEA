import { z } from 'zod'

export const userSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['SMS_ADMIN', 'REGULACAO', 'COORDENADOR', 'OPERADOR', 'GERENTE', 'RECEPCIONISTA', 'FATURISTA']),
  clinic_id: z.string().optional().nullable(),
  clinic_ids: z.array(z.string()).optional(),
  default_clinic_id: z.string().optional().nullable(),
  password: z.string().optional().refine((val) => !val || val.length >= 6, {
    message: 'A senha deve ter pelo menos 6 caracteres'
  }),
}).refine((data) => {
  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(data.role)
  if (isClinicRole && (!data.clinic_ids || data.clinic_ids.length === 0)) {
    return false
  }
  return true
}, {
  message: 'Pelo menos uma clínica deve ser selecionada para usuários de clínica',
  path: ['clinic_ids'],
}).refine((data) => {
  const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(data.role)
  if (isClinicRole && !data.default_clinic_id) {
    return false
  }
  return true
}, {
  message: 'Uma clínica padrão deve ser selecionada',
  path: ['default_clinic_id'],
})

export type UserFormData = z.infer<typeof userSchema>
