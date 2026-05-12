'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const contractItemSchema = z.object({
  procedure_id: z.string().uuid(),
  valor_sus: z.coerce.number().min(0),
  valor_rp: z.coerce.number().min(0),
  active: z.boolean().default(true)
})

const contractSchema = z.object({
  clinic_id: z.string().uuid("Clínica inválida"),
  contract_number: z.string().min(1, "O número do contrato é obrigatório"),
  valid_from: z.string().min(1, "A data de início é obrigatória"),
  valid_to: z.string().optional().nullable(),
  items: z.array(contractItemSchema).min(1, "O contrato deve ter pelo menos um procedimento")
})

export type ContractFormData = z.infer<typeof contractSchema>

export async function saveContractBulkAction(data: ContractFormData) {
  const supabase = await createClient()
  
  const validatedFields = contractSchema.safeParse(data)
  if (!validatedFields.success) return { error: 'Validação falhou' }

  if (data.valid_to) {
    if (new Date(data.valid_from) > new Date(data.valid_to)) {
      return { error: 'A data final deve ser maior ou igual a data inicial.' }
    }
  }

  // Deleta os itens anteriores se estivermos editando um contrato existente (identificado por numero e clinica)
  // Mas espera, se já existe e eles estão atualizando, podemos sobrescrever baseado no contract_number
  // Isso requer que o contract_number seja o identificador unico junto com a clinica.
  await supabase
    .from('clinic_procedure_prices')
    .delete()
    .eq('clinic_id', data.clinic_id)
    .eq('contract_number', data.contract_number)

  const itemsToInsert = data.items.map(item => ({
    clinic_id: data.clinic_id,
    contract_number: data.contract_number,
    procedure_id: item.procedure_id,
    valor_sus: item.valor_sus,
    valor_rp: item.valor_rp,
    active: item.active,
    valid_from: data.valid_from,
    valid_to: data.valid_to || null
  }))

  const { error } = await supabase.from('clinic_procedure_prices').insert(itemsToInsert)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/contracts')
  redirect('/dashboard/contracts')
}

export async function deleteContractBulkAction(clinic_id: string, contract_number: string) {
  const supabase = await createClient()

  // 1. Verificar se existem atendimentos vinculados a esta clínica
  // (Como o contrato é temporal, qualquer atendimento na clínica pode depender dele)
  const { count } = await supabase
    .from('attendances')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinic_id)

  if (count && count > 0) {
    return { error: 'Este contrato não pode ser excluído pois existem atendimentos vinculados a esta clínica que dependem destes valores históricos.' }
  }

  // Mesmo que não tenha atendimentos, a regra de governança agora impede a exclusão física.
  // Sugerimos apenas desativar os itens se necessário, mas por ora bloqueamos a ação.
  return { error: 'Por regras de segurança e auditoria (v0.9.0), contratos não podem ser excluídos fisicamente. Caso necessário, edite o contrato e desative os procedimentos individuais.' }
}
