import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import JSZip from 'jszip'

// Delete order: child tables first (reverse dependency)
const DELETE_ORDER = [
  'attendance_sessions',
  'attendances',
  'procedure_specialties',
  'professional_specialties',
  'professional_clinics',
  'patients',
  'users',
  'professionals',
  'procedures',
  'specialties',
  'clinics',
  'system_metadata',
] as const

// Insert order: parent tables first (dependency order)
const INSERT_ORDER = [
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

const EXPECTED_TABLES = new Set(INSERT_ORDER)

// Columns that are GENERATED ALWAYS in Postgres — must be stripped before insert
const GENERATED_COLUMNS: Record<string, string[]> = {
  procedures: ['valor_total'],
}

function stripGeneratedColumns(table: string, rows: any[]): any[] {
  const cols = GENERATED_COLUMNS[table]
  if (!cols || cols.length === 0) return rows
  return rows.map(row => {
    const cleaned = { ...row }
    for (const col of cols) {
      delete cleaned[col]
    }
    return cleaned
  })
}

function validateBackupStructure(backup: any): string | null {
  if (!backup || typeof backup !== 'object') {
    return 'Arquivo inválido: não é um objeto JSON válido'
  }
  if (!backup.meta || !backup.meta.app || backup.meta.app !== 'SisTEA') {
    return 'Arquivo inválido: não é um backup do SisTEA'
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return 'Arquivo inválido: seção de dados ausente'
  }

  const missingTables: string[] = []
  for (const table of EXPECTED_TABLES) {
    if (!Array.isArray(backup.data[table])) {
      missingTables.push(table)
    }
  }

  if (missingTables.length > 0) {
    return `Arquivo inválido: tabelas ausentes — ${missingTables.join(', ')}`
  }

  return null
}

async function extractJsonFromFile(file: File): Promise<any> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.zip')) {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    const jsonFile = Object.keys(zip.files).find(name => name.endsWith('.json'))

    if (!jsonFile) {
      throw new Error('O arquivo ZIP não contém nenhum arquivo .json')
    }

    const text = await zip.files[jsonFile].async('string')
    return JSON.parse(text)
  }

  if (fileName.endsWith('.json')) {
    const text = await file.text()
    return JSON.parse(text)
  }

  throw new Error('Formato não suportado. Envie um arquivo .zip ou .json')
}

export async function POST(request: NextRequest) {
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

    // 2. Parse uploaded file (ZIP or JSON)
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    let backup: any
    try {
      backup = await extractJsonFromFile(file)
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || 'Arquivo inválido' },
        { status: 400 }
      )
    }

    // 3. Validate structure
    const validationError = validateBackupStructure(backup)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // 4. Execute restore using admin client
    const adminClient = createAdminClient()
    const results: Record<string, number> = {}
    const errors: string[] = []

    // 4a. Delete existing data (child → parent order)
    for (const table of DELETE_ORDER) {
      const { error } = await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (error) {
        // Junction tables without 'id' column — delete with different approach
        const { error: error2 } = await adminClient.from(table).delete().gte('professional_id', '00000000-0000-0000-0000-000000000000')
        if (error2) {
          errors.push(`Erro ao limpar ${table}: ${error2.message}`)
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Erros durante limpeza: ${errors.join('; ')}` },
        { status: 500 }
      )
    }

    // 4b. Insert data (parent → child order)
    for (const table of INSERT_ORDER) {
      let rows = backup.data[table]
      if (!rows || rows.length === 0) {
        results[table] = 0
        continue
      }

      // Strip GENERATED ALWAYS columns before insert
      rows = stripGeneratedColumns(table, rows)

      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500
      let inserted = 0

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await adminClient.from(table).insert(batch)

        if (error) {
          errors.push(`Erro ao restaurar ${table} (lote ${Math.floor(i / batchSize) + 1}): ${error.message}`)
          break
        }
        inserted += batch.length
      }

      results[table] = inserted
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Restauração parcial — alguns erros ocorreram',
          details: errors,
          results,
        },
        { status: 500 }
      )
    }

    const totalRestored = Object.values(results).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      message: `Restauração concluída: ${totalRestored} registros restaurados`,
      results,
      backup_date: backup.meta.backup_date,
    })
  } catch (err: any) {
    console.error('Restore error:', err)
    return NextResponse.json(
      { error: 'Erro interno ao restaurar backup' },
      { status: 500 }
    )
  }
}
