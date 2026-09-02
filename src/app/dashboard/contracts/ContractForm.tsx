'use client'

import { useState, useTransition, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { saveContractBulkAction, type ContractFormData } from './actions'
import { formatNumberBR } from '@/utils/format'

export function ContractForm({
  initialData,
  clinics,
  procedures
}: {
  initialData?: any,
  clinics: any[],
  procedures: any[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // States for header
  const [clinicId, setClinicId] = useState(initialData?.clinic_id || '')
  const [coveredClinicIds, setCoveredClinicIds] = useState<string[]>(initialData?.covered_clinic_ids || [])
  const [contractNumber, setContractNumber] = useState(initialData?.contract_number || '')
  const [validFrom, setValidFrom] = useState(initialData?.valid_from || '')
  const [validTo, setValidTo] = useState(initialData?.valid_to || '')
  const [valorTotal, setValorTotal] = useState<number>(initialData?.valor_total ? Number(initialData.valor_total) : 0)

  // Encontrar a clínica titular selecionada e suas possíveis filiais
  const selectedClinic = clinics.find(c => c.id === clinicId)
  const filiais = clinics.filter(c => c.parent_clinic_id === clinicId)

  // Se trocar de clínica e for nova criação, atualizar filiais cobertas por padrão se desejar ou limpar
  useEffect(() => {
    if (!initialData && clinicId) {
      const childClinics = clinics.filter(c => c.parent_clinic_id === clinicId)
      // Por padrão, se a matriz tiver filiais, sugere incluí-las
      setCoveredClinicIds(childClinics.map(c => c.id))
    }
  }, [clinicId, clinics, initialData])

  const handleCurrencyChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '')
    let numericValue = Number(cleanValue) / 100
    if (isNaN(numericValue)) numericValue = 0
    setValorTotal(numericValue)
  }

  // States for items
  // Initialize items array with ALL procedures. If initialData has it, use it.
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    // Build initial items
    const loadedItems = procedures.map(p => {
      // see if we have it in initialData
      const existing = initialData?.items?.find((i: any) => i.procedure_id === p.id)
      if (existing) {
        return {
          procedure_id: p.id,
          code: p.code,
          name: p.name || p.description,
          description: p.description,
          valor_sus: Number(existing.valor_sus || 0).toFixed(2),
          valor_rp: Number(existing.valor_rp || 0).toFixed(2),
          active: existing.active,
          valid_from: existing.valid_from || '',
          valid_to: existing.valid_to || '',
          quantidade_contratada: existing.quantidade_contratada || 0,
          quantidade_saldo: existing.quantidade_saldo || 0
        }
      }
      return {
        procedure_id: p.id,
        code: p.code,
        name: p.name || p.description,
        description: p.description,
        valor_sus: Number(p.valor_sus || 0).toFixed(2),
        valor_rp: Number(p.valor_rp || 0).toFixed(2),
        active: false, // default to inactive unless they explicitly include it
        valid_from: '',
        valid_to: '',
        quantidade_contratada: 0,
        quantidade_saldo: 0
      }
    })
    setItems(loadedItems)
  }, [procedures, initialData])

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index][field] = value

    // Comportamento reativo: ao ativar um item, inicializa datas com as globais se as individuais estiverem em branco
    if (field === 'active' && value === true) {
      if (!newItems[index].valid_from) {
        newItems[index].valid_from = validFrom
      }
      if (!newItems[index].valid_to) {
        newItems[index].valid_to = validTo
      }
    }

    setItems(newItems)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const data: ContractFormData = {
      clinic_id: clinicId,
      contract_number: contractNumber,
      valid_from: validFrom,
      valid_to: validTo || undefined,
      valor_total: Number(valorTotal || 0),
      items: items.map(i => ({
        procedure_id: i.procedure_id,
        valor_sus: Number(i.valor_sus),
        valor_rp: Number(i.valor_rp),
        active: Boolean(i.active),
        valid_from: i.active && i.valid_from ? i.valid_from : undefined,
        valid_to: i.active && i.valid_to ? i.valid_to : undefined,
        quantidade_contratada: Number(i.quantidade_contratada || 0)
      })),
      covered_clinic_ids: coveredClinicIds,
      original_clinic_id: initialData?.clinic_id || undefined,
      original_contract_number: initialData?.contract_number || undefined
    }

    startTransition(async () => {
      const result = await saveContractBulkAction(data)
      if (result?.error) {
        alert(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-2xl border border-border/40">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Clínica Titular (Matriz / Unidade Principal)</label>
          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            required
            disabled={!!initialData}
            className="w-full flex h-12 rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
          >
            <option value="" disabled>Selecione a clínica</option>
            {clinics?.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.parent_clinic_id ? '(Filial)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nº do Contrato</label>
          <input
            type="text"
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            required
            className="w-full flex h-12 rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
            placeholder="Ex: CT-001/2026"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Valor Global do Contrato</label>
          <div className="relative flex items-center">
            <span className="absolute left-4 font-black text-muted-foreground text-sm">R$</span>
            <input
              type="text"
              value={formatNumberBR(valorTotal)}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              required
              className="w-full flex h-12 rounded-2xl border border-input bg-background pl-11 pr-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-black text-primary"
              placeholder="0,00"
            />
          </div>
          {initialData && (
            <span className="text-[11px] font-black text-emerald-500 block mt-1 tracking-wide uppercase">
              Saldo Restante: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialData.valor_saldo || 0)}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Início da Validade</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            required
            className="w-full flex h-12 rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fim da Validade (Opcional)</label>
          <input
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="w-full flex h-12 rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
          />
        </div>

        {/* Bloco de Unidades Abrangidas (Compartilhamento de Contrato com Filiais) */}
        {filiais.length > 0 && (
          <div className="md:col-span-3 bg-primary/5 p-5 rounded-2xl border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                  Unidades Abrangidas por este Contrato (Compartilhamento de Saldo e Serviços)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Marque abaixo quais filiais vinculadas compartilharão este contrato. As filiais selecionadas poderão lançar atendimentos consumindo os mesmos procedimentos e o saldo global deste contrato.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center space-x-3 text-sm bg-background/60 p-3.5 rounded-xl border border-border/40 opacity-90 cursor-not-allowed">
                <input type="checkbox" checked disabled className="rounded border-border h-4 w-4" />
                <span className="font-bold text-foreground truncate">{selectedClinic?.name}</span>
                <span className="text-[10px] bg-primary/10 text-primary font-black px-2 py-0.5 rounded-full ml-auto shrink-0">Matriz</span>
              </div>
              {filiais.map(filial => {
                const isChecked = coveredClinicIds.includes(filial.id)
                return (
                  <label key={filial.id} className={`flex items-center space-x-3 text-sm p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-background border-primary/60 shadow-sm' : 'bg-background/40 border-border/50 opacity-70'}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCoveredClinicIds([...coveredClinicIds, filial.id])
                        } else {
                          setCoveredClinicIds(coveredClinicIds.filter(id => id !== filial.id))
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="font-semibold text-foreground truncate">{filial.name}</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 rounded-full ml-auto shrink-0">Filial</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-foreground">Tabela de Procedimentos</h3>
            <p className="text-sm text-muted-foreground">Ative os procedimentos cobertos por este contrato, definindo valores individuais e cotas físicas.</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-border/40 rounded-2xl">
          <table className="min-w-[1150px] w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-4 text-center text-[11px] font-black text-muted-foreground uppercase tracking-widest w-20">
                  Ativo
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[160px]">
                  Valor SUS (R$)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[160px]">
                  Valor RP (R$)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[140px]">
                  Qtd. Pactuada
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[180px]">
                  Validade Início (Item)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[180px]">
                  Validade Fim (Item)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-[140px]">
                  Total (R$)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 bg-card">
              {items.map((item, index) => {
                const total = Number(item.valor_sus || 0) + Number(item.valor_rp || 0)
                const isItemActive = item.active
                return (
                  <Fragment key={item.procedure_id}>
                    {/* Linha 1: Checkbox e Identificação do Procedimento */}
                    <tr className={`transition-colors border-t border-border/30 ${!isItemActive ? 'opacity-50 bg-background/40' : 'bg-muted/15 hover:bg-muted/25'}`}>
                      <td rowSpan={2} className={`px-4 py-3 whitespace-nowrap text-center align-middle border-r border-border/20 w-20 transition-colors ${!isItemActive ? 'bg-background/20' : 'bg-muted/25'}`}>
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={(e) => handleItemChange(index, 'active', e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td colSpan={6} className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-background text-foreground border border-border/30 font-mono shadow-sm">
                            {item.code}
                          </span>
                          <span className="text-sm font-bold text-foreground leading-relaxed">
                            {item.name}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Linha 2: Inputs de Preço e Vigência individuais */}
                    <tr className={`transition-colors border-b-4 border-border/15 ${!isItemActive ? 'opacity-50 bg-background/40' : 'bg-muted/15 hover:bg-muted/25'}`}>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap w-[160px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.active}
                          value={item.valor_sus}
                          onChange={(e) => handleItemChange(index, 'valor_sus', e.target.value)}
                          onBlur={(e) => handleItemChange(index, 'valor_sus', Number(e.target.value || 0).toFixed(2))}
                          placeholder="0.00"
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm font-black text-foreground focus:text-primary focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all shadow-sm"
                        />
                      </td>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap w-[160px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.active}
                          value={item.valor_rp}
                          onChange={(e) => handleItemChange(index, 'valor_rp', e.target.value)}
                          onBlur={(e) => handleItemChange(index, 'valor_rp', Number(e.target.value || 0).toFixed(2))}
                          placeholder="0.00"
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm font-black text-foreground focus:text-primary focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all shadow-sm"
                        />
                      </td>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap w-[140px]">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          disabled={!item.active}
                          value={item.quantidade_contratada}
                          onChange={(e) => handleItemChange(index, 'quantidade_contratada', Number(e.target.value))}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm font-black text-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all shadow-sm"
                        />
                        {item.active && initialData && (
                          <span className="text-[10px] font-black text-emerald-500 block mt-1">
                            Saldo: {item.quantidade_saldo}
                          </span>
                        )}
                      </td>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap w-[180px]">
                        <input
                          type="date"
                          disabled={!item.active}
                          value={item.valid_from || ''}
                          onChange={(e) => handleItemChange(index, 'valid_from', e.target.value)}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all shadow-sm"
                        />
                      </td>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap w-[180px]">
                        <input
                          type="date"
                          disabled={!item.active}
                          value={item.valid_to || ''}
                          onChange={(e) => handleItemChange(index, 'valid_to', e.target.value)}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all shadow-sm"
                        />
                      </td>
                      <td className="px-4 pb-4 pt-1 whitespace-nowrap align-middle w-[140px]">
                        <span className="text-sm font-black text-primary block py-2">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-border/40">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || items.filter(i => i.active).length === 0}
          className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95"
        >
          {isPending ? 'Salvando...' : 'Salvar Contrato'}
        </button>
      </div>
    </form>
  )
}
