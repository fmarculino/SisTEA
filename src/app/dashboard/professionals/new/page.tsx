import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { ProfessionalForm } from '../ProfessionalForm'
import { redirect } from 'next/navigation'

export default async function NewProfessionalPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  
  const { data: specialtiesData } = await supabase.from('specialties').select('id, name, cbo').order('name')
  const specialties = specialtiesData || []

  const clinicsQuery = supabase.from('clinics').select('id, name').order('name')
  if (profile.role !== 'SMS_ADMIN' && profile.clinic_id) {
    clinicsQuery.eq('id', profile.clinic_id)
  }
  const { data: clinicsData } = await clinicsQuery
  const clinics = clinicsData || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Novo Profissional
        </h2>
      </div>
      <ProfessionalForm 
        clinics={clinics} 
        specialties={specialties}
        userRole={profile.role} 
        userClinicId={profile.clinic_id} 
      />
    </div>
  )
}
