import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import JSZip from 'jszip'

// Order matters: tables listed by dependency (parent → child)
const BACKUP_TABLES = [
  'clinics',
  'specialties',
  'procedures',
  'professionals',
  'users',
  'patients',
  'professional_clinics',
  'professional_specialties',
  'procedure_specialties',
  'attendances',
  'attendance_sessions',
  'system_metadata',
] as const

export async function GET() {
  try {
    // 1. Verify authenticated user is SMS_ADMIN
    const supabase = await createClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()

    if (authError || !auth?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    if (!profile || profile.role !== 'SMS_ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // 2. Use admin client to fetch all data (bypasses RLS)
    const adminClient = createAdminClient()
    const data: Record<string, any[]> = {}
    const tableCounts: Record<string, number> = {}
    let totalRecords = 0

    for (const table of BACKUP_TABLES) {
      const { data: rows, error } = await adminClient
        .from(table)
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        // Some junction tables may not have created_at, try without ordering
        const { data: rowsNoOrder, error: error2 } = await adminClient
          .from(table)
          .select('*')

        if (error2) {
          return NextResponse.json(
            { error: `Erro ao exportar tabela ${table}: ${error2.message}` },
            { status: 500 }
          )
        }
        data[table] = rowsNoOrder || []
      } else {
        data[table] = rows || []
      }

      tableCounts[table] = data[table].length
      totalRecords += data[table].length
    }

    // 3. Build backup object
    const backup = {
      meta: {
        app: 'SisTEA',
        version: '0.0.3-beta',
        backup_date: new Date().toISOString(),
        total_records: totalRecords,
        tables: tableCounts,
      },
      data,
    }

    // 4. Compress into ZIP
    const jsonStr = JSON.stringify(backup, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const zip = new JSZip()
    zip.file(`sistea-backup-${date}.json`, jsonStr)
    const zipData = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } })

    // 5. Return as downloadable ZIP file
    return new NextResponse(zipData.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="sistea-backup-${date}.zip"`,
      },
    })
  } catch (err: any) {
    console.error('Backup error:', err)
    return NextResponse.json(
      { error: 'Erro interno ao gerar backup' },
      { status: 500 }
    )
  }
}
