import { ClinicForm } from '../ClinicForm'

export default function NewClinicPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Nova Clínica
        </h2>
      </div>
      <ClinicForm />
    </div>
  )
}
