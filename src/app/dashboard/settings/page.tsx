import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .order('key')

  return (
    <div className="animate-in fade-in duration-700">
      <SettingsForm initialSettings={settings || []} />

      <div className="bg-muted/30 rounded-2xl p-6 border border-dashed border-border/60 max-w-4xl mt-10">
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          * Nota: Novas configurações serão adicionadas a este menu conforme a evolução do sistema,
          incluindo limites de geofencing, prazos de competência globais e regras de faturamento.
        </p>
      </div>
    </div>
  )
}
