import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { CheckCircle, Lock, Calendar as CalendarIcon } from 'lucide-react'
import { CloseCompetenceButton, ReopenCompetenceButton } from './CompetenceActions'
import { BpaExportButton } from './BpaExportButton'
import SendToMSButton from './SendToMSButton'
import { CompetencesFilterPanel } from './CompetencesFilterPanel'
import { Pagination } from '@/components/ui/Pagination'

export default async function CompetencesPage({
  searchParams,
}: {
  searchParams: { q?: string; clinic?: string; show_closed?: string; page?: string; limit?: string }
}) {
  const queryParams = await searchParams
  const profile = await getUserProfile()
  if (!profile) redirect('/')

  const supabase = await createClient()
  const isAdmin = profile.role === 'SMS_ADMIN'

  // Paginação e filtros padrão
  const page = Number(queryParams.page) || 1
  const limit = Number(queryParams.limit) || 20
  const from = (page - 1) * limit
  const to = from + limit

  // Listas de dados para filtros e exibições
  let closedCompetences: any[] = []
  let clinicsList: { id: string; name: string }[] = []
  let months: { month: number; year: number; label: string }[] = []
  let totalItems = 0
  
  // Lista filtrada e paginada definitiva
  let paginatedCompetences: any[] = []
  let paginatedMonths: any[] = []

  if (isAdmin) {
    // Buscar todas as competências fechadas
    const { data: comp } = await supabase
      .from('competences')
      .select('*, clinic:clinics(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    const closed = comp || []

    // Buscar todas as clínicas para popular o filtro e calcular abertas
    const { data: clinicsData } = await supabase
      .from('clinics')
      .select('id, name, competence_end_day')
      .eq('active', true)
      .order('name')
    clinicsList = clinicsData || []

    // Buscar todos os meses com atendimento para calcular competências que continuam ABERTAS
    const { data: attendances } = await supabase
      .from('attendances')
      .select('clinic_id, attendance_date')

    const clinicsMap = new Map()
    clinicsList.forEach(c => clinicsMap.set(c.id, c))

    const openCompetencesMap = new Map<string, any>()

    attendances?.forEach(a => {
      const clinic = clinicsMap.get(a.clinic_id)
      if (!clinic) return
      
      const dateParts = a.attendance_date.split('-')
      const day = parseInt(dateParts[2], 10)
      let month = parseInt(dateParts[1], 10)
      let year = parseInt(dateParts[0], 10)
      const endDay = clinic.competence_end_day || 31

      if (day > endDay && endDay < 31) {
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
      }
      
      const key = `${a.clinic_id}_${year}_${month}`
      
      // Se já está fechada para esta clínica, ignora
      if (closed.some(c => c.clinic_id === a.clinic_id && c.year === year && c.month === month)) {
        return
      }

      if (!openCompetencesMap.has(key)) {
        openCompetencesMap.set(key, {
          id: `open_${key}`,
          clinic_id: a.clinic_id,
          year,
          month,
          status: 'ABERTA',
          clinic: { name: clinic.name }
        })
      }
    })

    const openList = Array.from(openCompetencesMap.values())
    closedCompetences = [...openList, ...closed].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      if (a.month !== b.month) return b.month - a.month
      return a.clinic.name.localeCompare(b.clinic.name)
    })

    let filteredList = closedCompetences

    // 1. Chave de Toggle: mostrar_enviadas (por padrão, oculta apenas ENVIADA_MS)
    const showClosed = queryParams.show_closed === 'true'
    if (!showClosed) {
      filteredList = filteredList.filter(c => c.status !== 'ENVIADA_MS')
    }

    // 2. Filtro por clínica
    if (queryParams.clinic && queryParams.clinic !== 'all') {
      filteredList = filteredList.filter(c => c.clinic_id === queryParams.clinic)
    }

    // 3. Filtro por termo de busca q (busca por nome da clínica ou competência formatada)
    if (queryParams.q) {
      const cleanQ = queryParams.q.toLowerCase()
      filteredList = filteredList.filter(c => {
        const clinicName = (c.clinic as any)?.name?.toLowerCase() || ''
        const monthYear = `${String(c.month).padStart(2, '0')}/${c.year}`
        return clinicName.includes(cleanQ) || monthYear.includes(cleanQ)
      })
    }

    totalItems = filteredList.length
    paginatedCompetences = filteredList.slice(from, to)
  } else {
    // Visão da Clínica
    const { data: comp } = await supabase.from('competences').select('*').eq('clinic_id', profile.clinic_id)
    closedCompetences = comp || []

    const { data: clinicConfig } = await supabase.from('clinics').select('competence_end_day').eq('id', profile.clinic_id).single()
    const endDay = clinicConfig?.competence_end_day || 31

    // Buscar meses distintos com atendimentos
    const { data: attendances } = await supabase
      .from('attendances')
      .select('attendance_date')
      .eq('clinic_id', profile.clinic_id)

    const uniqueMonths = new Set<string>()
    
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

    // Adiciona meses que já estão fechados
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

    // --- Aplicar Filtros (Clínica) ---
    let filteredMonths = months

    // 1. Chave de Toggle: mostrar_enviadas (por padrão, oculta apenas as enviadas ao MS)
    const showClosed = queryParams.show_closed === 'true'
    if (!showClosed) {
      filteredMonths = filteredMonths.filter(m => {
        const isSent = closedCompetences.find(c => c.month === m.month && c.year === m.year && c.status === 'ENVIADA_MS')
        return !isSent
      })
    }

    // 2. Filtro por termo de busca q (busca pelo rótulo do mês)
    if (queryParams.q) {
      const cleanQ = queryParams.q.toLowerCase()
      filteredMonths = filteredMonths.filter(m => m.label.toLowerCase().includes(cleanQ))
    }

    totalItems = filteredMonths.length
    paginatedMonths = filteredMonths.slice(from, to)
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
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

      {/* Painel de Filtros e Busca Reativo */}
      <CompetencesFilterPanel isAdmin={isAdmin} clinicsList={clinicsList} />

      {/* Exibição */}
      {!isAdmin ? (
        <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/30">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="py-5 pl-8 pr-3 text-left text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
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
                {paginatedMonths.map((m) => {
                  const isClosed = closedCompetences.find(c => c.month === m.month && c.year === m.year && (c.status === 'FECHADA' || c.status === 'ENVIADA_MS'))
                  const isHistorical = isClosed?.is_historical || false
                  
                  return (
                    <tr key={`${m.year}-${m.month}`} className={`transition-colors group/row hover:bg-muted/30 ${isHistorical ? 'bg-purple-500/[0.01]' : ''}`}>
                      <td className="whitespace-nowrap py-6 pl-8 pr-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground capitalize">
                            {m.label}
                          </span>
                          {isHistorical && (
                            <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest mt-1">
                              Histórica (Manual)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-6">
                        {isClosed ? (
                          isHistorical ? (
                            <span className="inline-flex items-center rounded-xl bg-purple-500/10 px-3 py-1.5 text-[10px] font-black text-purple-600 border border-purple-500/20 uppercase tracking-widest leading-none">
                              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Histórica
                            </span>
                          ) : isClosed.status === 'ENVIADA_MS' ? (
                            <span className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black text-indigo-500 border border-indigo-500/20 uppercase tracking-widest leading-none">
                              <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Enviada (Hard Lock)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-xl bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-500 border border-red-500/20 uppercase tracking-widest leading-none">
                              <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Fechada
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-500 border border-emerald-500/20 uppercase tracking-widest leading-none">
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Aberta
                          </span>
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {!isClosed ? (
                            <CloseCompetenceButton clinicId={profile.clinic_id} month={m.month} year={m.year} />
                          ) : (
                            <>
                              <BpaExportButton clinicId={profile.clinic_id} month={m.month} year={m.year} isHistorical={isHistorical} />
                              {isClosed.status === 'ENVIADA_MS' && (
                                <span className="text-[10px] font-black text-indigo-500 border border-indigo-500/10 bg-indigo-500/[0.03] px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                  Bloqueada
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paginatedMonths.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-20 text-center">
                      <p className="text-sm text-muted-foreground font-medium">Nenhuma competência encontrada com os filtros atuais.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Paginação da Clínica */}
          <Pagination totalItems={totalItems} itemsPerPage={limit} currentPage={page} />
        </div>
      ) : (
        <div className="overflow-hidden bg-card border border-border/40 rounded-[2rem] shadow-xl">
          <div className="overflow-x-auto">
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
                {paginatedCompetences.map((comp) => (
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
                      {comp.is_historical ? (
                        <span className="inline-flex items-center rounded-xl bg-purple-500/10 px-3 py-1.5 text-[10px] font-black text-purple-600 border border-purple-500/20 uppercase tracking-widest leading-none">
                          <CalendarIcon className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Histórica (Manual)
                        </span>
                      ) : comp.status === 'ENVIADA_MS' ? (
                        <span className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black text-indigo-500 border border-indigo-500/20 uppercase tracking-widest leading-none">
                          <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Enviada (Hard Lock)
                        </span>
                      ) : comp.status === 'FECHADA' ? (
                        <span className="inline-flex items-center rounded-xl bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-500 border border-red-500/20 uppercase tracking-widest leading-none">
                          <Lock className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Fechada
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-500 border border-emerald-500/20 uppercase tracking-widest leading-none">
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Aberta
                        </span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-6 pl-3 pr-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {comp.status !== 'ABERTA' && (
                          <BpaExportButton clinicId={comp.clinic_id} month={comp.month} year={comp.year} isAdminView={true} isHistorical={comp.is_historical} />
                        )}
                        {comp.status === 'FECHADA' && (
                          <>
                            <ReopenCompetenceButton id={comp.id} />
                            <SendToMSButton id={comp.id} />
                          </>
                        )}
                        {comp.status === 'ABERTA' && (
                          <CloseCompetenceButton clinicId={comp.clinic_id} month={comp.month} year={comp.year} isAdminView={true} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedCompetences.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <p className="text-sm text-muted-foreground font-medium">Nenhuma competência encontrada com os filtros atuais.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Paginação do Admin */}
          <Pagination totalItems={totalItems} itemsPerPage={limit} currentPage={page} />
        </div>
      )}
    </div>
  )
}
