'use client'

import { FileText, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

interface ExportAuditPDFButtonProps {
  data: any[]
}

declare global {
  interface Window {
    jspdf: any;
  }
}

export function ExportAuditPDFButton({ data }: ExportAuditPDFButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const loadScript = (src: string) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  const handleExportPDF = async () => {
    if (data.length === 0 || isGenerating) return
    
    setIsGenerating(true)
    try {
      // Load jsPDF and AutoTable from CDN
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js')

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      // Header - Minimalist (White background)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('SisTEA - Auditoria Digital', 15, 15)
      
      doc.setDrawColor(200, 200, 200)
      doc.line(15, 18, 282, 18) // Decorative line
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Relatório gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 15, 23)
      doc.text(`Total de registros: ${data.length}`, 282, 23, { align: 'right' })

      // Table Data
      const tableColumn = ["Data", "Ação", "Tabela", "Usuário", "Descrição", "IP"]
      const tableRows = data.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
        log.action,
        log.table_name || 'SISTEMA',
        log.user_email,
        log.description,
        log.ip_address
      ])

      // @ts-ignore
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'grid', // Cleaner grid for reports
        headStyles: {
          fillColor: [240, 240, 240], // Light gray header
          textColor: [0, 0, 0],
          fontSize: 8,
          fontStyle: 'bold',
          lineWidth: 0.1
        },
        styles: {
          fontSize: 7, // More compact
          cellPadding: 1.5, // Much tighter
          textColor: [40, 40, 40],
          lineWidth: 0.1
        },
        columnStyles: {
          4: { cellWidth: 100 } // Description column wider
        },
        margin: { left: 15, right: 15 }
      })

      doc.save(`auditoria_sistea_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Ocorreu um erro ao gerar o PDF. Verifique sua conexão.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <button
      onClick={handleExportPDF}
      disabled={data.length === 0 || isGenerating}
      className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-6 py-2.5 text-sm font-bold text-slate-200 shadow-lg hover:bg-slate-700 hover:text-white transition-all active:scale-95 disabled:opacity-50"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
      ) : (
        <FileText className="h-4 w-4 text-sky-500" />
      )}
      {isGenerating ? 'Gerando...' : 'Relatório (PDF)'}
    </button>
  )
}
