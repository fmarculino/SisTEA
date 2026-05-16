import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyValidationHMAC, isLinkExpired } from '@/utils/token'
import { logAudit } from '@/lib/audit'

const MAX_ATTEMPTS = 5

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, token, hmac, timestamp } = body

    if (!sessionId || !token || !hmac || !timestamp) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // 1. Verify HMAC signature
    if (!verifyValidationHMAC(sessionId, Number(timestamp), hmac)) {
      return NextResponse.json({ error: 'Link inválido ou adulterado' }, { status: 403 })
    }

    // 2. Check expiration (5 minutes)
    if (isLinkExpired(Number(timestamp))) {
      return NextResponse.json({ error: 'Link expirado. Solicite um novo QR Code.' }, { status: 410 })
    }

    const supabase = createAdminClient()

    // 3. Get the session with its attendance (to find patient_id)
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, status, validated_at, validation_attempts, attendance_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    if (session.validated_at) {
      return NextResponse.json({ error: 'Esta sessão já foi validada anteriormente.' }, { status: 409 })
    }

    // 4. Check rate limit
    if (session.validation_attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ 
        error: 'Número máximo de tentativas excedido. Solicite um novo QR Code.',
        blocked: true 
      }, { status: 429 })
    }

    // 5. Get the attendance to find patient_id and calculation metadata
    const { data: attendance } = await supabase
      .from('attendances')
      .select(`
        attendance_date,
        patient_id,
        clinic_id, 
        procedure_id,
        patient:patients(name)
      `)
      .eq('id', session.attendance_id)
      .single()

    if (!attendance) {
      return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })
    }

    // 6. Get the patient's auth_token
    const { data: patient } = await supabase
      .from('patients')
      .select('auth_token')
      .eq('id', attendance.patient_id)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    }

    // 7. Increment attempt counter
    await supabase
      .from('attendance_sessions')
      .update({ validation_attempts: (session.validation_attempts || 0) + 1 })
      .eq('id', sessionId)

    // 8. Verify token (Secure Hash Verification)
    const { data: isPinValid } = await supabase.rpc('verify_patient_pin', {
      p_patient_id: attendance.patient_id,
      p_pin: token
    })

    if (!isPinValid) {
      const remaining = MAX_ATTEMPTS - (session.validation_attempts + 1)
      return NextResponse.json({ 
        error: `Token incorreto. ${remaining > 0 ? `Tentativas restantes: ${remaining}` : 'Sem tentativas restantes.'}`,
        attemptsRemaining: remaining
      }, { status: 401 })
    }

    // 9. SUCCESS — Update session status and record audit data
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Parse geolocation from body (optional, client sends it)
    const geo = body.geo || null

    const { error: updateError } = await supabase
      .from('attendance_sessions')
      .update({
        status: 'Realizada',
        validated_at: new Date().toISOString(),
        validation_ip: ip,
        validation_ua: userAgent,
        validation_geo: geo,
        validation_nonce: null, // Invalidate nonce (one-time use)
        validation_type: 'QR_CODE',
        action_by_login: null,
      })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar sessão' }, { status: 500 })
    }

    // 10. RECALCULATE TOTAL VALUE — Update parent attendance.value_applied
    // Fetch all sessions and procedure price to get the new total
    const { data: allSessions } = await supabase
      .from('attendance_sessions')
      .select('status')
      .eq('attendance_id', session.attendance_id)

    const realizedCount = (allSessions || []).filter((s: any) => s.status === 'Realizada').length

    // Get the price snapshot for this procedure/clinic/date
    const { data: contractPrice } = await supabase
      .from('clinic_procedure_prices')
      .select('valor_total')
      .eq('clinic_id', attendance.clinic_id)
      .eq('procedure_id', attendance.procedure_id)
      .eq('active', true)
      .lte('valid_from', attendance.attendance_date)
      .or(`valid_to.is.null,valid_to.gte.${attendance.attendance_date}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    let unitValue = 0
    if (contractPrice) {
      unitValue = Number(contractPrice.valor_total)
    } else {
      const { data: proc } = await supabase.from('procedures').select('valor_total').eq('id', attendance.procedure_id).single()
      unitValue = Number(proc?.valor_total) || 0
    }

    const newValue = realizedCount * unitValue

    await supabase
      .from('attendances')
      .update({ value_applied: newValue })
      .eq('id', session.attendance_id)

    // 11. AUDIT LOG - Record the patient signature
    const patientName = (attendance as any).patient?.name || 'Paciente'
    await logAudit({
      action: 'UPDATE',
      table_name: 'attendance_sessions',
      record_id: sessionId,
      ip: ip,
      userAgent: userAgent,
      new_data: { 
        status: 'Realizada', 
        validation_geo: geo,
        validation_ip: ip,
        validation_ua: userAgent
      },
      description: `Assinatura digital realizada pelo paciente ${patientName} para a sessão de ${attendance.attendance_date}.`
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Sessão validada com sucesso! O atendimento foi confirmado.' 
    })

  } catch (error: any) {
    console.error('Validation error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
