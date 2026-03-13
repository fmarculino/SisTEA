import { z } from 'zod'

export const procedureSchema = z.object({
  code: z.string().regex(/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d{1}$/, 'Código SUS inválido (00.00.00.000-0)'),
  name: z.string().min(1, 'Nome do procedimento é obrigatório'),
  description: z.string().optional().nullable(),
  valor_sus: z.coerce.number().min(0, 'Valor SUS deve ser positivo'),
  valor_rp: z.coerce.number().min(0, 'Valor Repasse deve ser positivo'),
  active: z.boolean().default(true),
})

export type ProcedureFormData = z.infer<typeof procedureSchema>
