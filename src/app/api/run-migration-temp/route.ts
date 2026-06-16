import { NextResponse } from 'next/server'
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
  }

  const client = new Client({ connectionString })
  
  try {
    await client.connect()
    
    const migrations = [
      '20260616214000_fix_patient_clinics_rls.sql',
      '20260616215000_fix_users_view_group_policy.sql'
    ]

    const results: string[] = []

    for (const migrationFile of migrations) {
      const filePath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile)
      const sql = fs.readFileSync(filePath, 'utf8')
      
      results.push(`Executing ${migrationFile}...`)
      await client.query(sql)
      results.push(`Successfully executed ${migrationFile}`)
    }

    return NextResponse.json({ success: true, log: results })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  } finally {
    await client.end()
  }
}
