import { z } from 'zod'

export const cidSchema = z.object({
  code: z.string().min(1, 'Código CID é obrigatório'),
  name: z.string().min(1, 'Nome/Descrição é obrigatório'),
  active: z.boolean().default(true),
})

export type CidFormData = z.infer<typeof cidSchema>
