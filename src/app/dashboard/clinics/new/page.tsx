import { ClinicForm } from '../ClinicForm'

export default function NewClinicPage() {
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
      <ClinicForm />
    </div>
  )
}
