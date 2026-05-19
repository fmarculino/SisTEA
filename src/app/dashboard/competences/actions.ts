'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/dal'
import { logAudit } from '@/lib/audit'

export async function closeCompetenceAction(clinic_id: string, month: number, year: number) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (!profile || profile.clinic_id !== clinic_id) {
    if (profile?.role !== 'SMS_ADMIN') {
      return { error: 'Sem permissão para fechar esta competência.' }
    }
  }

  const { error } = await supabase.from('competences').upsert({
    clinic_id,
    month,
    year,
    status: 'FECHADA',
    closed_at: new Date().toISOString(),
    closed_by: profile.id
  }, {
    onConflict: 'clinic_id,month,year'
  })

  if (error) return { error: error.message }
  
  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id, month, year, action: 'FECHADA', performed_by: profile.id
  })

  await logAudit({
    action: 'UPDATE',
    table_name: 'competences',
    description: `Encerrou competência ${month}/${year} para a clínica ID: ${clinic_id}`,
    new_data: { status: 'FECHADA', clinic_id, month, year }
  })

  revalidatePath('/dashboard/competences')
  return { success: true }
}

export async function reopenCompetenceAction(id: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    return { error: 'Apenas administradores podem reabrir competências.' }
  }

  // Busca a competência para auditoria e verificação
  const { data: comp } = await supabase.from('competences').select('*').eq('id', id).single()
  
  if (!comp) return { error: 'Competência não encontrada.' }

  // REESTORNO DE SALDOS CONTRATUAIS CASO A COMPETÊNCIA TENHA SIDO ENVIADA AO MS
  if (comp.status === 'ENVIADA_MS') {
    const firstDay = `${comp.year}-${String(comp.month).padStart(2, '0')}-01`
    const lastDayDate = new Date(comp.year, comp.month, 0)
    const lastDay = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .eq('clinic_id', comp.clinic_id)
      .eq('active', true)
      .lte('valid_from', lastDay)
      .or(`valid_to.is.null,valid_to.gte.${firstDay}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (contract) {
      // Buscar produções que haviam sido faturadas
      const { data: attendances } = await supabase
        .from('attendances')
        .select('procedure_id, value_applied')
        .eq('clinic_id', comp.clinic_id)
        .eq('month_year', `${String(comp.month).padStart(2, '0')}/${comp.year}`)
        .in('status', ['Realizada', 'REALIZADO'])

      if (attendances && attendances.length > 0) {
        let totalFaturamento = 0
        const procedureCounts = new Map<string, number>()
        attendances.forEach(att => {
          totalFaturamento += att.value_applied || 0
          const count = procedureCounts.get(att.procedure_id) || 0
          procedureCounts.set(att.procedure_id, count + 1)
        })

        const procedureIds = Array.from(procedureCounts.keys())
        const procedureCountsArr = procedureIds.map(id => procedureCounts.get(id)!)

        // Chamar stored procedure de reestorno transacional
        const { error: rpcError } = await supabase.rpc('refund_contract_balances', {
          p_contract_id: contract.id,
          p_total_value: totalFaturamento,
          p_procedure_ids: procedureIds,
          p_procedure_counts: procedureCountsArr
        })

        if (rpcError) {
          return { error: `Erro ao reestornar saldos do contrato no banco: ${rpcError.message}` }
        }
      }
    }
  }

  const { error } = await supabase.from('competences').delete().eq('id', id)
  
  if (error) return { error: error.message }

  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id: comp.clinic_id, month: comp.month, year: comp.year, action: 'REABERTA', performed_by: profile.id
  })

  await logAudit({
    action: 'DELETE',
    table_name: 'competences',
    record_id: id,
    description: `Reabriu competência ${comp.month}/${comp.year} para a clínica ID: ${comp.clinic_id}. Todos os saldos contratuais consumidos foram reestornados com sucesso.`,
    old_data: comp
  })
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}

export async function sendToMSCompetenceAction(id: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'SMS_ADMIN') {
    return { error: 'Apenas administradores podem enviar ao MS.' }
  }

  const { data: comp } = await supabase.from('competences').select('*').eq('id', id).single()
  if (!comp) return { error: 'Competência não encontrada.' }
  if (comp.status === 'ENVIADA_MS') {
    return { error: 'Esta competência já foi enviada ao Ministério da Saúde.' }
  }

  // 1. IDENTIFICAR O CONTRATO ATIVO NA VIGÊNCIA DESTA COMPETÊNCIA
  const firstDay = `${comp.year}-${String(comp.month).padStart(2, '0')}-01`
  const lastDayDate = new Date(comp.year, comp.month, 0)
  const lastDay = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*')
    .eq('clinic_id', comp.clinic_id)
    .eq('active', true)
    .lte('valid_from', lastDay)
    .or(`valid_to.is.null,valid_to.gte.${firstDay}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contractError) {
    return { error: `Erro ao buscar contrato correspondente: ${contractError.message}` }
  }

  if (!contract) {
    return { error: '❌ Bloqueio Contratual: Não foi encontrado nenhum contrato ativo configurado para esta clínica no período desta competência. Cadastre um contrato correspondente antes de fechar a competência.' }
  }

  // 2. BUSCAR AS PRODUÇÕES FATURADAS E CALCULAR OS VALORES/QUANTIDADES
  const compStr = `${String(comp.month).padStart(2, '0')}/${comp.year}`
  const { data: attendances, error: attError } = await supabase
    .from('attendances')
    .select('id, procedure_id, value_applied')
    .eq('clinic_id', comp.clinic_id)
    .eq('month_year', compStr)
    .in('status', ['Realizada', 'REALIZADO'])

  if (attError) {
    return { error: `Erro ao buscar faturamentos da competência: ${attError.message}` }
  }

  if (!attendances || attendances.length === 0) {
    return { error: 'Nenhuma produção realizada encontrada nesta competência para enviar ao Ministério da Saúde.' }
  }

  let totalFaturamento = 0
  const procedureCounts = new Map<string, number>()

  attendances.forEach(att => {
    totalFaturamento += att.value_applied || 0
    const count = procedureCounts.get(att.procedure_id) || 0
    procedureCounts.set(att.procedure_id, count + 1)
  })

  // 3. BUSCAR OS ITENS DO CONTRATO PARA VALIDAR TETOS FÍSICOS
  const { data: contractItems, error: itemsError } = await supabase
    .from('clinic_procedure_prices')
    .select('procedure_id, quantidade_saldo, quantidade_contratada, procedures(code, description)')
    .eq('contract_id', contract.id)

  if (itemsError) {
    return { error: `Erro ao carregar itens pactuados do contrato: ${itemsError.message}` }
  }

  const itemsMap = new Map<string, any>()
  contractItems?.forEach(item => {
    itemsMap.set(item.procedure_id, item)
  })

  // --- VALIDAÇÕES DE ESTOURO (BR-012) ---
  
  // A. Estouro Financeiro
  if (totalFaturamento > (contract.valor_saldo || 0)) {
    return {
      error: `❌ Estouro de Limite Financeiro (BR-012): O valor total do faturamento desta competência (R$ ${totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ultrapassa o saldo financeiro disponível no contrato (R$ ${Number(contract.valor_saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). O envio foi bloqueado. Realize glosas ou ajustes para enquadrar no saldo restante.`
    }
  }

  // B. Procedimentos não pactuados
  for (const [procId, count] of procedureCounts.entries()) {
    const item = itemsMap.get(procId)
    if (!item) {
      const { data: fallbackProc } = await supabase
        .from('procedures')
        .select('code, name')
        .eq('id', procId)
        .maybeSingle()
      const code = fallbackProc?.code || 'Desconhecido'
      const name = fallbackProc?.name || 'Procedimento sem cadastro'
      return {
        error: `❌ Procedimento Não Pactuado: O procedimento "${code} - ${name}" foi realizado na competência mas não faz parte do contrato ativo desta clínica. Corrija ou remova estes atendimentos para prosseguir.`
      }
    }
  }

  // 4. PERSISTIR DEDUÇÃO USANDO PROCESSO COM CONCURRENCY LOCK NO BANCO
  const procedureIds = Array.from(procedureCounts.keys())
  const procedureCountsArr = procedureIds.map(id => procedureCounts.get(id)!)

  const { error: rpcError } = await supabase.rpc('deduct_contract_balances', {
    p_contract_id: contract.id,
    p_total_value: totalFaturamento,
    p_procedure_ids: procedureIds,
    p_procedure_counts: procedureCountsArr
  })

  if (rpcError) {
    return { error: `Erro na dedução de saldos contratuais: ${rpcError.message}` }
  }

  // 5. ATUALIZAR STATUS DA COMPETÊNCIA E LOG DE AUDITORIA
  const { error: updateError } = await supabase.from('competences').update({
    status: 'ENVIADA_MS'
  }).eq('id', id)
  
  if (updateError) {
    // Se falhar a atualização, reestorna os saldos para manter a consistência transacional!
    await supabase.rpc('refund_contract_balances', {
      p_contract_id: contract.id,
      p_total_value: totalFaturamento,
      p_procedure_ids: procedureIds,
      p_procedure_counts: procedureCountsArr
    })
    return { error: `Erro ao atualizar status da competência: ${updateError.message}` }
  }

  // Auditoria
  await supabase.from('competence_audit_logs').insert({
    clinic_id: comp.clinic_id, month: comp.month, year: comp.year, action: 'ENVIADA_MS', performed_by: profile.id
  })

  await logAudit({
    action: 'UPDATE',
    table_name: 'competences',
    record_id: id,
    description: `Enviou competência ${comp.month}/${comp.year} ao Ministério da Saúde (Hard Lock) - Clínica ID: ${comp.clinic_id}. Saldos do Contrato ID ${contract.id} deduzidos (Financeiro: R$ ${totalFaturamento.toFixed(2)}).`,
    new_data: { status: 'ENVIADA_MS', contract_id: contract.id, valor_deduzido: totalFaturamento }
  })
  
  revalidatePath('/dashboard/competences')
  return { success: true }
}
