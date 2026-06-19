import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { ValidationClient } from './ValidationClient'

export const dynamic = 'force-dynamic'

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export default async function ValidarPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ h?: string; t?: string }>;
}) {
  const { sessionId } = await params
  const { h: hmac, t: timestamp } = await searchParams

  if (!hmac || !timestamp) notFound()

  const supabase = createAdminClient()

  // Fetch session info (limited data — no sensitive info)
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select(`
      id, 
      session_date, 
      start_time, 
      end_time, 
      status, 
      validated_at,
      attendance:attendances(
        patient_id,
        clinic_id,
        patient:patients(name),
        professional:professionals(name),
        procedure:procedures(name)
      )
    `)
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const attendance = (session as any).attendance
  const patientId = attendance?.patient_id
  const clinicId = attendance?.clinic_id

  let allowsMultipleSignatures = false
  let otherPendingSessions: { sessionId: string; startTime: string; endTime: string; professionalName: string; procedureName: string }[] = []

  if (clinicId) {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('allows_multiple_signatures')
      .eq('id', clinicId)
      .single()
    
    allowsMultipleSignatures = !!clinic?.allows_multiple_signatures
  }

  if (allowsMultipleSignatures && clinicId && patientId) {
    const { data: otherSessions } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        start_time,
        end_time,
        session_date,
        status,
        validated_at,
        attendances!inner(patient_id, clinic_id, professional:professionals(name), procedure:procedures(name))
      `)
      .eq('session_date', session.session_date)
      .is('validated_at', null)
      .neq('id', sessionId)
      .eq('attendances.patient_id', patientId)
      .eq('attendances.clinic_id', clinicId)

    otherPendingSessions = (otherSessions || []).map((s: any) => ({
      sessionId: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      professionalName: s.attendances?.professional?.name || 'Profissional',
      procedureName: s.attendances?.procedure?.name || 'Procedimento'
    }))
  }

  const sessionInfo = {
    sessionId: session.id,
    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,
    status: session.status,
    alreadyValidated: !!session.validated_at,
    patientName: attendance?.patient?.name || 'Paciente',
    professionalName: attendance?.professional?.name || 'Profissional',
    procedureName: attendance?.procedure?.name || 'Procedimento',
    allowsMultipleSignatures,
    otherPendingSessions,
  }

  return (
    <ValidationClient
      sessionInfo={sessionInfo}
      hmac={hmac}
      timestamp={timestamp}
    />
  )
}
