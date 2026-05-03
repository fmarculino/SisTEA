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
        patient:patients(name),
        professional:professionals(name),
        procedure:procedures(name)
      )
    `)
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const attendance = (session as any).attendance
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
  }

  return (
    <ValidationClient
      sessionInfo={sessionInfo}
      hmac={hmac}
      timestamp={timestamp}
    />
  )
}
