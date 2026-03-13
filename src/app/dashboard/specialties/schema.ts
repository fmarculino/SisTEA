import { z } from 'zod'

export const specialtySchema = z.object({
  name: z.string().min(1, 'Nome da especialidade é obrigatória'),
  cbo: z.string().min(1, 'Código CBO é obrigatório'),
})

export type SpecialtyFormData = z.infer<typeof specialtySchema>
