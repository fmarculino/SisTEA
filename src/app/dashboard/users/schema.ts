import { z } from 'zod'

export const userSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role: z.enum(['SMS_ADMIN', 'CLINIC_USER']),
  clinic_id: z.string().optional().nullable(),
  password: z.string().optional().refine((val) => !val || val.length >= 6, {
    message: 'A senha deve ter pelo menos 6 caracteres'
  }),
}).refine((data) => {
  if (data.role === 'CLINIC_USER' && !data.clinic_id) {
    return false
  }
  return true
}, {
  message: 'Clínica é obrigatória para usuários de clínica',
  path: ['clinic_id'],
})

export type UserFormData = z.infer<typeof userSchema>
