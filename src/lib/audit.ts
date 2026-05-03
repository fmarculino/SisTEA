import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { getUserProfile } from '@/lib/dal'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'ACCESS'

interface AuditParams {
  action: AuditAction
  table_name?: string
  record_id?: string
  old_data?: any
  new_data?: any
  description: string
}

/**
 * Logs an event to the immutable audit_logs table.
 * Automatically captures user information, IP address, and timestamp.
 */
export async function logAudit({
  action,
  table_name,
  record_id,
  old_data,
  new_data,
  description
}: AuditParams) {
  try {
    const supabase = await createClient()
    const profile = await getUserProfile()
    const headerList = await headers()
    
    // Capture IP and User Agent
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 
               headerList.get('x-real-ip') || 
               'unknown'
    const userAgent = headerList.get('user-agent') || 'unknown'

    const { error } = await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      user_email: profile?.email,
      user_role: profile?.role,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      ip_address: ip,
      user_agent: userAgent,
      description
    })

    if (error) {
      console.error('Failed to log audit event:', error)
    }
  } catch (err) {
    console.error('Critical error in audit logger:', err)
  }
}
