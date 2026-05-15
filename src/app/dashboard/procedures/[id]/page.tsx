import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { ProcedureForm } from '../ProcedureForm'
import { notFound, redirect } from 'next/navigation'

export default async function EditProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') redirect('/dashboard')

  const supabase = await createClient()
  const { id } = await params
  
  const { data: procedure } = await supabase.from('procedures').select('*').eq('id', id).single()
  if (!procedure) notFound()

  const [
    specialtiesRes, 
    serviceClassificationsRes, 
    cidRes,
    currentSpecialties,
    currentServiceClassifications,
    currentCid
  ] = await Promise.all([
    supabase.from('specialties').select('id, name, cbo').eq('active', true).order('name'),
    supabase.from('service_classifications').select('id, name, service_code, classification_code').eq('active', true).order('service_code'),
    supabase.from('cid').select('id, name, code').eq('active', true).order('code'),
    supabase.from('procedure_specialties').select('specialty_id').eq('procedure_id', id),
    supabase.from('procedure_service_classifications').select('service_classification_id').eq('procedure_id', id),
    supabase.from('procedure_cid').select('cid_id').eq('procedure_id', id),
  ])

  const initialData = {
    ...procedure,
    specialty_ids: currentSpecialties.data?.map(s => s.specialty_id) || [],
    service_classification_ids: currentServiceClassifications.data?.map(s => s.service_classification_id) || [],
    cid_ids: currentCid.data?.map(s => s.cid_id) || []
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Editar Procedimento
        </h2>
      </div>
      <ProcedureForm 
        id={procedure.id}
        initialData={initialData}
        specialties={specialtiesRes.data || []}
        serviceClassifications={serviceClassificationsRes.data || []}
        cidList={cidRes.data || []}
      />
    </div>
  )
}
