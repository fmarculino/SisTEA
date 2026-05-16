import { z } from 'zod'

export const procedureSchema = z.object({
  code: z.string().optional().nullable(),
  hasNoCode: z.boolean().optional().default(false),
  name: z.string().min(1, 'Nome do procedimento é obrigatório'),
  description: z.string().optional().nullable(),
  valor_sus: z.coerce.number().min(0, 'Valor SUS deve ser positivo'),
  valor_rp: z.coerce.number().min(0, 'Valor Repasse deve ser positivo'),
  bpa_type: z.enum(['BPA_I', 'BPA_C', 'AMBOS', 'NAO_APLICA']).default('NAO_APLICA'),
  active: z.boolean().default(true),
  specialty_ids: z.array(z.string()).min(1, 'Selecione ao menos uma especialidade'),
  service_classification_ids: z.array(z.string()).optional().default([]),
  cid_ids: z.array(z.string()).optional().default([]),
  max_quantity: z.coerce.number().optional().nullable(),
  min_age: z.coerce.number().optional().nullable(),
  max_age: z.coerce.number().optional().nullable(),
}).refine((data) => {
  if (data.hasNoCode) return true;
  if (!data.code) return false;
  // Aceita tanto o formato mascarado (00.00.00.000-0) quanto o limpo (10 dígitos)
  const clean = data.code.replace(/\D/g, '');
  return clean.length === 10;
}, {
  message: "Código SUS inválido (deve ter 10 dígitos)",
  path: ["code"],
});

export type ProcedureFormData = z.infer<typeof procedureSchema>
