import { z } from 'zod'

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

const isYearValid = (dateStr?: string | null) => {
  if (!dateStr) return true
  const year = parseInt(dateStr.split('-')[0], 10)
  return !isNaN(year) && year >= 2020 && year <= 2035
}

export const attendanceSessionSchema = z.object({
  id: z.string().uuid().optional(),
  session_date: z.string()
    .min(1, 'Data é obrigatória')
    .regex(dateRegex, 'Data da sessão inválida (formato esperado: AAAA-MM-DD)')
    .refine(isYearValid, { message: 'O ano da sessão deve estar entre 2020 e 2035' }),
  start_time: z.string().min(1, 'Hora inicial é obrigatória'),
  end_time: z.string().min(1, 'Hora final é obrigatória'),
  status: z.enum(['Realizada', 'Pendente', 'Glosado', 'Não Realizado', 'Faltou']),
  justification: z.string().optional().nullable(),
  // Audit fields (read-only)
  validated_at: z.string().optional().nullable(),
  validation_ip: z.string().optional().nullable(),
  validation_ua: z.string().optional().nullable(),
  validation_geo: z.any().optional().nullable(),
  action_by_login: z.string().optional().nullable(),
  validation_type: z.string().optional().nullable(),
})

export const attendanceSchema = z.object({
  patient_id: z.string().uuid('Paciente é obrigatório'),
  professional_id: z.string().uuid('Profissional é obrigatório'),
  procedure_id: z.string().uuid('Procedimento é obrigatório'),
  clinic_id: z.string().uuid('Clínica é obrigatória'),
  attendance_date: z.string()
    .min(1, 'Data de atendimento é obrigatória')
    .regex(dateRegex, 'Data de atendimento inválida (formato esperado: AAAA-MM-DD)')
    .refine(isYearValid, { message: 'O ano do atendimento deve estar entre 2020 e 2035' }),
  
  // Novos campos do cabeçalho da guia
  auth_number: z.string().optional().nullable(),
  authorization_date: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || dateRegex.test(val), { message: 'Data de autorização inválida' })
    .refine(isYearValid, { message: 'O ano de autorização deve estar entre 2020 e 2035' }),
  authorized_quantity: z.coerce.number().min(1, 'Quantidade deve ser maior que zero').default(20),
  cid: z.string().optional().nullable(),
  service_classification_id: z.string().optional().nullable().transform(val => (val === '' ? null : val)),
  attendance_character: z.string().optional().nullable(),
  quantity: z.coerce.number().default(1).optional().nullable(),
  
  value_applied: z.coerce.number().min(0, 'Valor não pode ser negativo'),
  professional_cbo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_historical_import: z.boolean().optional().default(false),
  
  sessions: z.array(attendanceSessionSchema).default([]),
})

export type AttendanceSessionData = z.infer<typeof attendanceSessionSchema>
export type AttendanceFormData = z.infer<typeof attendanceSchema>
