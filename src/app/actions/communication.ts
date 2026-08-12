'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'

export interface WhatsAppSendParams {
  phone: string
  message: string
  overrideConfigs?: Record<string, any>
}

export interface WhatsAppResult {
  success: boolean
  mode?: string
  error?: string
  fallbackUrl?: string
  canFallback?: boolean
  isManualMode?: boolean
  data?: any
}

// Auxiliar para carregar dicionário de configurações do sistema (tabela system_settings)
async function getCommunicationConfigs() {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')

    if (error || !data) {
      return {}
    }

    const configs: Record<string, any> = {}
    data.forEach(item => {
      configs[item.key] = item.value
    })
    return configs
  } catch (err) {
    console.error('Erro ao buscar configurações de comunicação:', err)
    return {}
  }
}

/**
 * Função utilitária para tratar o telefone de WhatsApp no Brasil
 * Trata o DDI 55, DDD e a variação do 9º dígito (DDDs >= 31)
 */
function getWhatsAppPhoneVariants(phone: string): { primary: string; secondary?: string } {
  let clean = phone.replace(/\D/g, '')
  if (!clean) return { primary: '' }

  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean
  }

  // Regra do Brasil (DDI 55)
  if (clean.startsWith('55') && clean.length === 13) {
    const ddd = parseInt(clean.substring(2, 4), 10)
    // Para DDDs >= 31 (ex: 94, 91, 81, etc.), o JID do WhatsApp costuma ser registrado SEM o 9º dígito (12 dígitos)
    if (ddd >= 31 && clean[4] === '9') {
      const without9 = clean.substring(0, 4) + clean.substring(5)
      return {
        primary: without9,
        secondary: clean
      }
    }
  }

  // Se tiver 12 dígitos e DDD >= 31, a variante secundária é com o 9 (13 dígitos)
  if (clean.startsWith('55') && clean.length === 12) {
    const ddd = parseInt(clean.substring(2, 4), 10)
    if (ddd >= 31) {
      const with9 = clean.substring(0, 4) + '9' + clean.substring(4)
      return {
        primary: clean,
        secondary: with9
      }
    }
  }

  return { primary: clean }
}

/**
 * Envia uma mensagem via WhatsApp de acordo com o motor ativo nas configurações (Chatwoot, AstraCalls, Custom, Manual)
 */
export async function sendWhatsAppMessageAction({ phone, message, overrideConfigs }: WhatsAppSendParams): Promise<WhatsAppResult> {
  const dbConfigs = await getCommunicationConfigs()
  const configs = { ...dbConfigs, ...(overrideConfigs || {}) }
  const phoneVariants = getWhatsAppPhoneVariants(phone)
  const cleanPhone = phoneVariants.primary

  if (!cleanPhone) {
    return {
      success: false,
      error: 'Telefone inválido ou não informado.'
    }
  }

  const modo = String(configs['whatsapp_modo'] || 'api_chatwoot').trim()
  const fallbackPermitido = String(configs['whatsapp_permitir_fallback']) !== 'false' && configs['whatsapp_permitir_fallback'] !== false
  const fallbackUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`

  // 1. Modo Manual (WhatsApp Web)
  if (modo === 'manual') {
    return {
      success: false,
      isManualMode: true,
      fallbackUrl,
      error: 'O sistema está configurado para envio manual via WhatsApp Web.'
    }
  }

  // 2. Modo Chatwoot API (Padrão)
  if (modo === 'api_chatwoot') {
    let baseUrl = String(configs['whatsapp_chatwoot_url'] || '').trim()
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    const accountId = String(configs['whatsapp_chatwoot_account_id'] || '').trim()
    const inboxId = String(configs['whatsapp_chatwoot_inbox_id'] || '').trim()
    const token = String(configs['whatsapp_chatwoot_token'] || '').trim()

    if (!baseUrl || !accountId || !token) {
      return {
        success: false,
        mode: 'api_chatwoot',
        error: 'Configurações do Chatwoot incompletas (URL, Account ID e Token são obrigatórios).',
        fallbackUrl,
        canFallback: fallbackPermitido
      }
    }

    const endpoint = `${baseUrl}/api/v1/accounts/${accountId}/conversations`

    const attemptChatwoot = async (destinationPhone: string) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': token
          },
          body: JSON.stringify({
            source_id: destinationPhone,
            inbox_id: inboxId || undefined,
            message: {
              content: message
            }
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        let resData: any = null
        const resText = await response.text()
        try { resData = JSON.parse(resText) } catch { resData = resText }

        return { ok: response.ok, status: response.status, data: resData }
      } catch (err: any) {
        clearTimeout(timeoutId)
        return { ok: false, status: 0, error: err.name === 'AbortError' ? 'Tempo limite (timeout) excedido ao conectar ao Chatwoot.' : err.message }
      }
    }

    try {
      // 1ª Tentativa com variante primária
      let res = await attemptChatwoot(phoneVariants.primary)

      // Se falhou e temos variante secundária (com/sem 9), tentar novamente
      if (!res.ok && phoneVariants.secondary) {
        const retryRes = await attemptChatwoot(phoneVariants.secondary)
        if (retryRes.ok) {
          res = retryRes
        }
      }

      if (res.ok) {
        return {
          success: true,
          mode: 'api_chatwoot',
          data: res.data
        }
      } else {
        const errorDetail = typeof res.data === 'object' && res.data?.message 
          ? res.data.message 
          : (typeof res.data === 'string' ? res.data : (res.error || `Status HTTP ${res.status}`))
        return {
          success: false,
          mode: 'api_chatwoot',
          error: `Chatwoot API Error (${res.status}): ${errorDetail}`,
          fallbackUrl,
          canFallback: fallbackPermitido
        }
      }
    } catch (err: any) {
      return {
        success: false,
        mode: 'api_chatwoot',
        error: `Erro ao conectar com Chatwoot: ${err.message}`,
        fallbackUrl,
        canFallback: fallbackPermitido
      }
    }
  }

  // 3. Modo AstraCalls API
  if (modo === 'api_astracall') {
    let baseUrl = String(configs['whatsapp_astracall_url'] || 'https://astracall.atb.app.br').trim()
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    let sid = String(configs['whatsapp_astracall_sid'] || 'default').trim()
    const apiKey = String(configs['whatsapp_astracall_key'] || '').trim()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['X-API-Key'] = apiKey
    }

    const attemptSend = async (sessionSid: string, destinationPhone: string) => {
      const endpoint = `${baseUrl}/api/sessions/${encodeURIComponent(sessionSid)}/messages/text`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: destinationPhone,
            text: message
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        let resData: any = null
        const resText = await response.text()
        try { resData = JSON.parse(resText) } catch { resData = resText }

        return { ok: response.ok, status: response.status, data: resData }
      } catch (err: any) {
        clearTimeout(timeoutId)
        return { ok: false, status: 0, error: err.name === 'AbortError' ? 'Timeout na API AstraCalls' : err.message }
      }
    }

    try {
      let res = await attemptSend(sid, phoneVariants.primary)
      if (!res.ok && phoneVariants.secondary) {
        const retryRes = await attemptSend(sid, phoneVariants.secondary)
        if (retryRes.ok) res = retryRes
      }

      if (res.ok) {
        return {
          success: true,
          mode: 'api_astracall',
          data: res.data
        }
      } else {
        const errorDetail = typeof res.data === 'object' && res.data?.message ? res.data.message : (typeof res.data === 'string' ? res.data : `Status HTTP ${res.status}`)
        return {
          success: false,
          mode: 'api_astracall',
          error: `AstraCalls API Error (${res.status}): ${errorDetail}`,
          fallbackUrl,
          canFallback: fallbackPermitido
        }
      }
    } catch (err: any) {
      return {
        success: false,
        mode: 'api_astracall',
        error: `Erro ao conectar na API AstraCalls: ${err.message}`,
        fallbackUrl,
        canFallback: fallbackPermitido
      }
    }
  }

  // 4. Modo API Customizada
  if (modo === 'api_custom') {
    const customUrl = String(configs['whatsapp_custom_url'] || '').trim()
    const method = String(configs['whatsapp_custom_method'] || 'POST').trim().toUpperCase()
    const rawHeaders = String(configs['whatsapp_custom_headers'] || '').trim()
    const rawPayload = String(configs['whatsapp_custom_payload'] || '{"to": "{{phone}}", "text": "{{message}}"}').trim()

    if (!customUrl) {
      return {
        success: false,
        mode: 'api_custom',
        error: 'URL da API Customizada não foi configurada.',
        fallbackUrl,
        canFallback: fallbackPermitido
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (rawHeaders) {
      try {
        if (rawHeaders.startsWith('{')) {
          Object.assign(headers, JSON.parse(rawHeaders))
        } else {
          rawHeaders.split('\n').forEach((line: string) => {
            const parts = line.split(':')
            if (parts.length >= 2) {
              const k = parts[0].trim()
              const v = parts.slice(1).join(':').trim()
              if (k && v) headers[k] = v
            }
          })
        }
      } catch (err) {
        console.warn('Erro ao processar headers customizados:', err)
      }
    }

    const processedUrl = customUrl.replace(/\{\{phone\}\}/g, cleanPhone).replace(/\{\{message\}\}/g, encodeURIComponent(message))
    let processedBody: any = undefined
    if (method !== 'GET' && method !== 'HEAD') {
      const jsonBodyString = rawPayload
        .replace(/\{\{phone\}\}/g, cleanPhone)
        .replace(/\{\{message\}\}/g, JSON.stringify(message).slice(1, -1))
      
      try {
        processedBody = JSON.stringify(JSON.parse(jsonBodyString))
      } catch {
        processedBody = jsonBodyString
      }
    }

    try {
      const response = await fetch(processedUrl, { method, headers, body: processedBody })
      const resText = await response.text()
      let resData: any = resText
      try { resData = JSON.parse(resText) } catch {}

      if (response.ok) {
        return { success: true, mode: 'api_custom', data: resData }
      } else {
        return {
          success: false,
          mode: 'api_custom',
          error: `API Customizada Error (${response.status}): ${typeof resData === 'string' ? resData : JSON.stringify(resData)}`,
          fallbackUrl,
          canFallback: fallbackPermitido
        }
      }
    } catch (err: any) {
      return {
        success: false,
        mode: 'api_custom',
        error: `Erro ao conectar na API Customizada: ${err.message}`,
        fallbackUrl,
        canFallback: fallbackPermitido
      }
    }
  }

  return {
    success: false,
    error: `Modo de WhatsApp desconhecido: ${modo}`,
    fallbackUrl,
    canFallback: fallbackPermitido
  }
}

/**
 * Ação de teste para validar as configurações da API de WhatsApp (Chatwoot / AstraCalls / Custom)
 */
export async function testWhatsAppConnectionAction(phone: string, overrideConfigs?: Record<string, any>): Promise<WhatsAppResult> {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    return { success: false, error: 'Apenas administradores podem testar a conexão.' }
  }

  const message = `🤖 *Teste SisTEA - Saúde Marabá*\n\nConexão com a API de WhatsApp configurada e validada com sucesso em ${new Date().toLocaleString('pt-BR')}!`
  return await sendWhatsAppMessageAction({ phone, message, overrideConfigs })
}

/**
 * Server Action para envio do Token de Validação Digital do Paciente
 */
export async function sendPatientTokenWhatsAppAction({
  patientId,
  phone,
  patientName,
  token
}: {
  patientId: string
  phone: string
  patientName: string
  token: string
}): Promise<WhatsAppResult> {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'SMS_ADMIN') {
    return { success: false, error: 'Apenas administradores podem enviar o token do paciente.' }
  }

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return { success: false, error: 'O paciente não possui um telefone válido cadastrado para envio.' }
  }

  const message =
    `Olá, *${patientName}*! Esta é uma mensagem da *Central de Regulação da SMS (SisTEA)*.\n\n` +
    `O seu token de validação digital para confirmar seus atendimentos via QR Code é: *${token}*\n\n` +
    `Este código é pessoal e deve ser utilizado *APENAS por você* no momento da assinatura digital.\n\n` +
    `⚠️ *ATENÇÃO:* Não forneça este código para funcionários da clínica. Guarde-o com segurança para garantir o registro correto das suas sessões.`

  return await sendWhatsAppMessageAction({ phone, message })
}
