import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { ProfessionalForm } from '../ProfessionalForm'
import { notFound, redirect } from 'next/navigation'

export default async function EditProfessionalPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { id } = await params
  
  const { data: profData } = await supabase
    .from('professionals')
    .select('*, professional_clinics(clinic_id), professional_specialties(specialty_id)')
    .eq('id', id)
    .single()
    
  if (!profData) notFound()

  const prof = {
    ...profData,
    clinic_ids: profData.professional_clinics?.map((pc: any) => pc.clinic_id) || [],
    specialty_ids: profData.professional_specialties?.map((ps: any) => ps.specialty_id) || []
  }

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
          Editar Profissional
        </h2>
      </div>
      <ProfessionalForm 
        id={prof.id}
        initialData={prof}
        clinics={clinics} 
        specialties={specialties}
        userRole={profile.role} 
        userClinicId={profile.clinic_id} 
      />
    </div>
  )
}
