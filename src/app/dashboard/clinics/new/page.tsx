import { createClient } from '@/utils/supabase/server'
import { ClinicForm } from '../ClinicForm'

export default async function NewClinicPage() {
  const supabase = await createClient()
  
  // Buscar clínicas que podem ser matrizes (que não são filiais)
  const { data: matrixClinics } = await supabase
    .from('clinics')
    .select('id, name, cnes')
    .is('parent_clinic_id', null)
    .eq('active', true)
    .order('name')

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Nova <span className="text-primary tracking-tighter">Clínica</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          Cadastre uma nova unidade de atendimento no sistema SisTEA. Certifique-se de preencher todos os campos obrigatórios.
        </p>
      </div>
      <ClinicForm matrixClinics={matrixClinics || []} />
    </div>
  )
}
