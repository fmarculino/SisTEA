'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveContractBulkAction, type ContractFormData } from './actions'

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
  const [contractNumber, setContractNumber] = useState(initialData?.contract_number || '')
  const [validFrom, setValidFrom] = useState(initialData?.valid_from || '')
  const [validTo, setValidTo] = useState(initialData?.valid_to || '')

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
          description: p.description,
          valor_sus: Number(existing.valor_sus || 0).toFixed(2),
          valor_rp: Number(existing.valor_rp || 0).toFixed(2),
          active: existing.active
        }
      }
      return {
        procedure_id: p.id,
        code: p.code,
        description: p.description,
        valor_sus: Number(p.valor_sus || 0).toFixed(2),
        valor_rp: Number(p.valor_rp || 0).toFixed(2),
        active: false // default to inactive unless they explicitly include it
      }
    })
    setItems(loadedItems)
  }, [procedures, initialData])

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Filtramos apenas os que tem valores preenchidos se o usuario marcar active, 
    // mas na verdade vamos mandar todos como um array
    const data: ContractFormData = {
      clinic_id: clinicId,
      contract_number: contractNumber,
      valid_from: validFrom,
      valid_to: validTo || undefined,
      items: items.map(i => ({
        procedure_id: i.procedure_id,
        valor_sus: Number(i.valor_sus),
        valor_rp: Number(i.valor_rp),
        active: Boolean(i.active)
      }))
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-6 rounded-2xl border border-border/40">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Clínica</label>
          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            required
            className="w-full flex h-12 rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
          >
            <option value="" disabled>Selecione a clínica</option>
            {clinics?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black text-foreground">Tabela de Procedimentos</h3>
        <p className="text-sm text-muted-foreground">Ative os procedimentos cobertos por este contrato e ajuste os valores se necessário.</p>
        
        <div className="overflow-x-auto border border-border/40 rounded-2xl">
          <table className="min-w-full divide-y divide-border/30">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-16">
                  Ativo
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                  Procedimento
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-40">
                  Valor SUS (R$)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-40">
                  Valor RP (R$)
                </th>
                <th scope="col" className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground uppercase tracking-widest w-32">
                  Total (R$)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 bg-card">
              {items.map((item, index) => {
                const total = Number(item.valor_sus || 0) + Number(item.valor_rp || 0)
                return (
                  <tr key={item.procedure_id} className={`transition-colors ${!item.active ? 'opacity-60 bg-muted/10' : 'bg-background'}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={item.active}
                        onChange={(e) => handleItemChange(index, 'active', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{item.code}</span>
                        <span className="text-[11px] text-muted-foreground font-medium uppercase truncate max-w-xs" title={item.description}>
                          {item.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black ${item.active ? 'text-primary/50' : 'text-muted-foreground'}`}>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.active}
                          value={item.valor_sus}
                          onChange={(e) => handleItemChange(index, 'valor_sus', e.target.value)}
                          onBlur={(e) => handleItemChange(index, 'valor_sus', Number(e.target.value || 0).toFixed(2))}
                          className="w-full h-10 rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm font-black text-foreground focus:text-primary focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black ${item.active ? 'text-primary/50' : 'text-muted-foreground'}`}>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.active}
                          value={item.valor_rp}
                          onChange={(e) => handleItemChange(index, 'valor_rp', e.target.value)}
                          onBlur={(e) => handleItemChange(index, 'valor_rp', Number(e.target.value || 0).toFixed(2))}
                          className="w-full h-10 rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm font-black text-foreground focus:text-primary focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-black text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                      </span>
                    </td>
                  </tr>
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
