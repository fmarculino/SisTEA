'use client'

import { useState } from 'react'
import { Download, AlertTriangle, X, FileText, Loader2 } from 'lucide-react'
import { validateBpaExportAction, generateBpaTxtAction } from './bpa-actions'

interface BpaExportButtonProps {
  clinicId: string;
  month: number;
  year: number;
  isAdminView?: boolean;
}

export function BpaExportButton({ clinicId, month, year, isAdminView = false }: BpaExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [errors, setErrors] = useState<any[]>([])

  const monthYearStr = `${String(month).padStart(2, '0')}/${year}`

  const handleExport = async () => {
    setIsLoading(true)
    setErrors([])
    
    // 1. Pre-flight Validation
    const valResult = await validateBpaExportAction(clinicId, monthYearStr)
    
    if (valResult.error) {
      alert(valResult.error)
      setIsLoading(false)
      return
    }

    if (valResult.data?.hasErrors) {
      setErrors(valResult.data.errors)
      setShowErrors(true)
      setIsLoading(false)
      return
    }

    // 2. Generation
    const genResult = await generateBpaTxtAction(clinicId, monthYearStr)
    
    if (genResult.error) {
      alert(genResult.error)
      setIsLoading(false)
      return
    }

    // 3. Download File
    if (genResult.txtContent) {
      const blob = new Blob([genResult.txtContent], { type: 'text/plain;charset=windows-1252' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = genResult.filename || `BPA_EXPORT_${monthYearStr.replace('/', '')}.txt` 
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }

    setIsLoading(false)
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={isLoading}
        className={`inline-flex items-center justify-center font-bold transition-all duration-200 active:scale-95 ${
          isAdminView 
            ? 'px-4 py-2 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90' 
            : 'px-6 py-3 text-sm rounded-2xl bg-foreground text-background hover:bg-foreground/90 w-full'
        } disabled:opacity-50 disabled:pointer-events-none`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2 stroke-[2.5]" />
        )}
        {isAdminView ? 'Exportar BPA' : 'Baixar Arquivo BPA'}
      </button>

      {/* Pre-flight Error Modal */}
      {showErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/50 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-red-500/5">
              <div className="flex items-center text-red-600">
                <AlertTriangle className="w-6 h-6 mr-3 stroke-[2.5]" />
                <h3 className="text-xl font-black tracking-tight">Inconsistências no Cadastro</h3>
              </div>
              <button 
                onClick={() => setShowErrors(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-muted-foreground mb-6 font-medium">
                O arquivo BPA não pode ser gerado porque encontramos informações obrigatórias faltando em algumas produções deste mês. 
                Por favor, corrija os cadastros abaixo e tente novamente.
              </p>
              
              <div className="space-y-4">
                {errors.map((err, idx) => (
                  <div key={idx} className="bg-muted/30 border border-border/50 rounded-2xl p-4">
                    <div className="flex items-start">
                      <FileText className="w-5 h-5 mt-0.5 mr-3 text-muted-foreground" />
                      <div>
                        <h4 className="font-bold text-foreground">{err.patient_name}</h4>
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mt-1 mb-2">ID: {err.attendance_id.slice(0, 8)}...</p>
                        <ul className="space-y-1">
                          {err.missing_fields.map((field: string, fIdx: number) => (
                            <li key={fIdx} className="text-sm text-red-600 flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
                              {field}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-border/50 bg-muted/20 flex justify-end">
              <button
                onClick={() => setShowErrors(false)}
                className="px-6 py-2.5 text-sm font-bold bg-foreground text-background rounded-xl hover:bg-foreground/90 transition-colors"
              >
                Entendi, vou corrigir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
