import { z } from 'zod'

export const serviceClassificationSchema = z.object({
  service_code: z.string().min(1, 'Código do serviço é obrigatório'),
  classification_code: z.string().min(1, 'Código de classificação é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  active: z.boolean().default(true),
})

export type ServiceClassificationFormData = z.infer<typeof serviceClassificationSchema>
