import { z } from 'zod'

export const attendanceSessionSchema = z.object({
  id: z.string().uuid().optional(),
  session_date: z.string().min(1, 'Data é obrigatória'),
  start_time: z.string().min(1, 'Hora inicial é obrigatória'),
  end_time: z.string().min(1, 'Hora final é obrigatória'),
  status: z.enum(['Realizada', 'Pendente', 'Glosado', 'Não Realizado']),
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
  attendance_date: z.string().min(1, 'Data de atendimento é obrigatória'),
  
  // Novos campos do cabeçalho da guia
  auth_number: z.string().optional().nullable(),
  authorization_date: z.string().optional().nullable(),
  authorized_quantity: z.coerce.number().min(1, 'Quantidade deve ser maior que zero').default(20),
  cid: z.string().optional().nullable(),
  service_classification_id: z.string().optional().nullable().transform(val => (val === '' ? null : val)),
  attendance_character: z.string().optional().nullable(),
  quantity: z.coerce.number().default(1).optional().nullable(),
  
  value_applied: z.coerce.number().min(0, 'Valor não pode ser negativo'),
  professional_cbo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  
  sessions: z.array(attendanceSessionSchema).default([]),
})

export type AttendanceSessionData = z.infer<typeof attendanceSessionSchema>
export type AttendanceFormData = z.infer<typeof attendanceSchema>
