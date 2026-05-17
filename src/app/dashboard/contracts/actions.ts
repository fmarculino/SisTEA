'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const contractItemSchema = z.object({
  procedure_id: z.string().uuid(),
  valor_sus: z.coerce.number().min(0),
  valor_rp: z.coerce.number().min(0),
  active: z.boolean().default(true),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable()
})

const contractSchema = z.object({
  clinic_id: z.string().uuid("Clínica inválida"),
  contract_number: z.string().min(1, "O número do contrato é obrigatório"),
  valid_from: z.string().min(1, "A data de início é obrigatória"),
  valid_to: z.string().optional().nullable(),
  items: z.array(contractItemSchema).min(1, "O contrato deve ter pelo menos um procedimento"),
  original_clinic_id: z.string().uuid().optional().nullable(),
  original_contract_number: z.string().optional().nullable()
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

  // Definir vínculos originais/alvo para a deleção em caso de atualização/renomeação
  const targetClinicId = data.original_clinic_id || data.clinic_id
  const targetContractNumber = data.original_contract_number || data.contract_number

  // NOVA TRAVA DE VALIDAÇÃO DE VIGÊNCIAS POR PROCEDIMENTO (Apenas para procedimentos ativos)
  const activeItems = data.items.filter(item => item.active)

  if (activeItems.length > 0) {
    // Buscar todos os preços ativos da mesma clínica em outros contratos
    const { data: existingPrices, error: fetchError } = await supabase
      .from('clinic_procedure_prices')
      .select('contract_number, procedure_id, valid_from, valid_to, procedures(code, description)')
      .eq('clinic_id', data.clinic_id)
      .neq('contract_number', targetContractNumber)
      .neq('contract_number', data.contract_number)
      .eq('active', true)

    if (fetchError) {
      return { error: `Erro ao validar vigências anteriores: ${fetchError.message}` }
    }

    if (existingPrices && existingPrices.length > 0) {
      for (const item of activeItems) {
        // Obter vigência individual do item ou herdada da global do contrato
        const itemFromStr = item.valid_from || data.valid_from
        const itemToStr = item.valid_to || data.valid_to || null

        const itemFrom = new Date(itemFromStr)
        const itemTo = itemToStr ? new Date(itemToStr) : null

        if (itemTo && itemFrom > itemTo) {
          return { error: `A data final individual do procedimento deve ser maior ou igual a data inicial.` }
        }

        // Encontra conflitos para o procedimento específico
        const conflicts = existingPrices.filter((ep: any) => ep.procedure_id === item.procedure_id)

        for (const conflict of conflicts) {
          const extFrom = new Date(conflict.valid_from)
          const extTo = conflict.valid_to ? new Date(conflict.valid_to) : null

          // Lógica matemática de sobreposição
          const startOverlap = extTo === null || itemFrom <= extTo
          const endOverlap = itemTo === null || itemTo >= extFrom

          if (startOverlap && endOverlap) {
            const procInfo = conflict.procedures as any
            const code = procInfo?.code || 'Desconhecido'
            const description = procInfo?.description || 'Procedimento sem nome'

            const formatPeriod = (from: string, to: string | null) => {
              const f = new Date(from).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
              const t = to ? new Date(to).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Indefinido'
              return `${f} a ${t}`
            }

            return {
              error: `❌ Conflito de Item Contratual: O procedimento "${code} - ${description}" já possui um preço pactuado ativo nesta clínica no período de ${formatPeriod(conflict.valid_from, conflict.valid_to)} (Contrato: "${conflict.contract_number}"). Para reajustar o valor ou vigência deste item, defina a validade final dele no contrato anterior antes de lançar o novo aditivo.`
            }
          }
        }
      }
    }
  }

  // Deleta os itens anteriores se estivermos editando um contrato existente (identificado por numero e clinica originais ou atuais)
  await supabase
    .from('clinic_procedure_prices')
    .delete()
    .eq('clinic_id', targetClinicId)
    .eq('contract_number', targetContractNumber)

  const itemsToInsert = data.items.map(item => ({
    clinic_id: data.clinic_id,
    contract_number: data.contract_number,
    procedure_id: item.procedure_id,
    valor_sus: item.valor_sus,
    valor_rp: item.valor_rp,
    active: item.active,
    valid_from: item.valid_from || data.valid_from,
    valid_to: item.valid_to || data.valid_to || null
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
