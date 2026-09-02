import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Busca o preço e item contratual efetivo para um procedimento, clínica e data.
 * Suporta contratos diretos e contratos compartilhados entre Matriz e Filiais.
 */
export async function getEffectiveContractPrice(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string,
  date: string
) {
  // 1. Tenta buscar pelo clinic_id direto na tabela de preços
  const { data: directPrice } = await supabase
    .from('clinic_procedure_prices')
    .select('id, valor_total, contract_id, contract_number, quantidade_saldo, quantidade_contratada, active, valid_from, valid_to')
    .eq('clinic_id', clinicId)
    .eq('procedure_id', procedureId)
    .eq('active', true)
    .lte('valid_from', date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (directPrice) return directPrice

  // 2. Se não encontrou direto, busca se há contrato cobrindo esta clínica via contract_clinics
  const { data: contractLinks } = await supabase
    .from('contract_clinics')
    .select('contract_id')
    .eq('clinic_id', clinicId)

  if (contractLinks && contractLinks.length > 0) {
    const contractIds = contractLinks.map(c => c.contract_id)
    const { data: sharedPrice } = await supabase
      .from('clinic_procedure_prices')
      .select('id, valor_total, contract_id, contract_number, quantidade_saldo, quantidade_contratada, active, valid_from, valid_to')
      .in('contract_id', contractIds)
      .eq('procedure_id', procedureId)
      .eq('active', true)
      .lte('valid_from', date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sharedPrice) return sharedPrice
  }

  // 3. Fallback: se for filial, verificar se a matriz tem contrato ativo
  const { data: clinic } = await supabase
    .from('clinics')
    .select('parent_clinic_id')
    .eq('id', clinicId)
    .single()

  if (clinic?.parent_clinic_id) {
    const { data: matrixPrice } = await supabase
      .from('clinic_procedure_prices')
      .select('id, valor_total, contract_id, contract_number, quantidade_saldo, quantidade_contratada, active, valid_from, valid_to')
      .eq('clinic_id', clinic.parent_clinic_id)
      .eq('procedure_id', procedureId)
      .eq('active', true)
      .lte('valid_from', date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (matrixPrice) return matrixPrice
  }

  return null
}

/**
 * Identifica o contrato ativo efetivo para uma clínica no período da competência.
 * Suporta contratos diretos e contratos compartilhados via contract_clinics ou matriz.
 */
export async function getEffectiveContractForClinic(
  supabase: SupabaseClient,
  clinicId: string,
  firstDay: string,
  lastDay: string
) {
  // 1. Busca contrato direto da clínica
  const { data: directContract } = await supabase
    .from('contracts')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .lte('valid_from', lastDay)
    .or(`valid_to.is.null,valid_to.gte.${firstDay}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (directContract) return directContract

  // 2. Busca contrato compartilhado via contract_clinics
  const { data: ccList } = await supabase
    .from('contract_clinics')
    .select('contract_id')
    .eq('clinic_id', clinicId)

  if (ccList && ccList.length > 0) {
    const contractIds = ccList.map(cc => cc.contract_id)
    const { data: sharedContract } = await supabase
      .from('contracts')
      .select('*')
      .in('id', contractIds)
      .eq('active', true)
      .lte('valid_from', lastDay)
      .or(`valid_to.is.null,valid_to.gte.${firstDay}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sharedContract) return sharedContract
  }

  // 3. Fallback se for filial: busca contrato da matriz
  const { data: clinic } = await supabase
    .from('clinics')
    .select('parent_clinic_id')
    .eq('id', clinicId)
    .single()

  if (clinic?.parent_clinic_id) {
    const { data: matrixContract } = await supabase
      .from('contracts')
      .select('*')
      .eq('clinic_id', clinic.parent_clinic_id)
      .eq('active', true)
      .lte('valid_from', lastDay)
      .or(`valid_to.is.null,valid_to.gte.${firstDay}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (matrixContract) return matrixContract
  }

  return null
}
