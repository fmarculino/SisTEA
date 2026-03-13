import { SpecialtyForm } from '../SpecialtyForm'

export default function NewSpecialtyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
          Nova Especialidade / Função
        </h2>
      </div>
      <SpecialtyForm />
    </div>
  )
}
