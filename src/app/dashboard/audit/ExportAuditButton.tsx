'use client'

import { Download } from 'lucide-react'
import { format } from 'date-fns'

interface ExportAuditButtonProps {
  data: any[]
}

export function ExportAuditButton({ data }: ExportAuditButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return

    const headers = [
      'ID',
      'Data/Hora',
      'Acao',
      'Usuario',
      'Papel',
      'Descricao',
      'Tabela',
      'Record ID',
      'IP',
      'Dispositivo'
    ]

    const csvContent = [
      headers.join(';'),
      ...data.map(log => [
        log.id,
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        log.action,
        log.user_email,
        log.user_role,
        `"${log.description?.replace(/"/g, '""')}"`,
        log.table_name || '',
        log.record_id || '',
        log.ip_address,
        `"${log.user_agent?.replace(/"/g, '""')}"`
      ].join(';'))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `auditoria_sis_tea_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      Exportar Logs (CSV)
    </button>
  )
}
