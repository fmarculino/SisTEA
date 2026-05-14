import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { CheckCircle, Lock, Calendar as CalendarIcon } from 'lucide-react'
import { CloseCompetenceButton, ReopenCompetenceButton } from './CompetenceActions'
import { BpaExportButton } from './BpaExportButton'
import SendToMSButton from './SendToMSButton'

export default async function CompetencesPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/')

  const supabase = await createClient()
  const isAdmin = profile.role === 'SMS_ADMIN'

  // Fetch closed competences
  let closedCompetences = []
  let clinics = []
  let months: { month: number, year: number, label: string }[] = []

  if (isAdmin) {
    const { data: comp } = await supabase.from('competences').select('*, clinic:clinics(name)').order('year', { ascending: false }).order('month', { ascending: false })
    closedCompetences = comp || []
  } else {
    const { data: comp } = await supabase.from('competences').select('*').eq('clinic_id', profile.clinic_id)
    closedCompetences = comp || []

    const { data: clinicConfig } = await supabase.from('clinics').select('competence_end_day').eq('id', profile.clinic_id).single()
    const endDay = clinicConfig?.competence_end_day || 31

    // Fetch distinct attendance months for this clinic
    const { data: attendances } = await supabase
      .from('attendances')
      .select('attendance_date')
      .eq('clinic_id', profile.clinic_id)

    const uniqueMonths = new Set<string>()
    
    // Add months from existing attendances
    attendances?.forEach(a => {
      const dateParts = a.attendance_date.split('-')
      const day = parseInt(dateParts[2], 10)
      let month = parseInt(dateParts[1], 10)
      let year = parseInt(dateParts[0], 10)

      if (day > endDay && endDay < 31) {
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
      }
      uniqueMonths.add(`${year}-${month}`)
    })

    // Add months that are already closed (even if they have no attendances for some reason)
    closedCompetences.forEach(c => {
      uniqueMonths.add(`${c.year}-${c.month}`)
    })

    months = Array.from(uniqueMonths).map(m => {
      const [year, month] = m.split('-')
      const d = new Date(Number(year), Number(month) - 1, 1)
      return {
        month: Number(month),
        year: Number(year),
        label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      }
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
          Gestão de <span className="text-primary tracking-tighter">Competências</span>
        </h2>
        <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
          {isAdmin 
            ? 'Monitore e gerencie o fechamento de faturamento das clínicas parceiras.'
            : 'Encerre o mês para enviar o faturamento consolidado. Após o encerramento, não será possível alterar dados.'}
        </p>
      </div>

      {!isAdmin ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {months.map((m) => {
            const isClosed = closedCompetences.find(c => c.month === m.month && c.year === m.year && (c.status === 'FECHADA' || c.status === 'ENVIADA_MS'))
            return (
              <div key={`${m.year}-${m.month}`} className="bg-card border border-border/40 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black capitalize text-foreground">{m.label}</h3>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Faturamento</p>
                  </div>
                  <div className={`p-3 rounded-2xl ${isClosed ? (isClosed.status === 'ENVIADA_MS' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-red-500/10 text-red-500') : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {isClosed ? <Lock className="w-5 h-5 stroke-[2.5]" /> : <CheckCircle className="w-5 h-5 stroke-[2.5]" />}
                  </div>
                </div>

                {!isClosed ? (
                  <div className="mt-8">
                    <CloseCompetenceButton clinicId={profile.clinic_id} month={m.month} year={m.year} />
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <div className="flex flex-col gap-2">
                      <BpaExportButton clinicId={profile.clinic_id} month={m.month} year={m.year} />
                      {isClosed.status === 'ENVIADA_MS' && (
                        <span className="text-[10px] text-center font-bold text-indigo-500 uppercase tracking-widest mt-2">
                          HARD LOCK - ENVIADA AO MS
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Clínica
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Mês/Ano
                </th>
                <th scope="col" className="px-3 py-5 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Status
                </th>
                <th scope="col" className="relative py-5 pl-3 pr-8 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {closedCompetences?.map((comp) => (
                <tr key={comp.id} className="transition-colors group/row hover:bg-muted/30">
                  <td className="whitespace-nowrap py-6 pl-8 pr-3">
                    <span className="text-sm font-bold text-foreground">
                      {(comp.clinic as any)?.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    <span className="text-sm font-bold text-foreground">
                      {String(comp.month).padStart(2, '0')}/{comp.year}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-6">
                    {comp.status === 'ENVIADA_MS' ? (
                      <span className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black text-indigo-500 border border-indigo-500/20 uppercase tracking-widest leading-none">
                        <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Enviada (Hard Lock)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-500 border border-red-500/20 uppercase tracking-widest leading-none">
                        <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Fechada
                      </span>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <BpaExportButton clinicId={comp.clinic_id} month={comp.month} year={comp.year} isAdminView={true} />
                      {comp.status === 'FECHADA' && (
                        <>
                          <ReopenCompetenceButton id={comp.id} />
                          <SendToMSButton id={comp.id} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {closedCompetences.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <p className="text-sm text-muted-foreground font-medium">Nenhuma competência fechada no momento.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
