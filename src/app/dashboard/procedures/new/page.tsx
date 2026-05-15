import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { ProcedureForm } from '../ProcedureForm'
import { redirect } from 'next/navigation'

export default async function NewProcedurePage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') redirect('/dashboard')

  const supabase = await createClient()
  
  const [specialtiesRes, serviceClassificationsRes, cidRes] = await Promise.all([
    supabase.from('specialties').select('id, name, cbo').eq('active', true).order('name'),
    supabase.from('service_classifications').select('id, name, service_code, classification_code').eq('active', true).order('service_code'),
    supabase.from('cid').select('id, name, code').eq('active', true).order('code')
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Procedimento
        </h2>
      </div>
      <ProcedureForm 
        specialties={specialtiesRes.data || []} 
        serviceClassifications={serviceClassificationsRes.data || []}
        cidList={cidRes.data || []}
      />
    </div>
  )
}
