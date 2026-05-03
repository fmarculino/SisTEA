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
      'Data Validacao',
      'IP',
      'Dispositivo',
      'Latitude',
      'Longitude',
      'Distancia (m)',
      'Remota',
      'Paciente',
      'Profissional',
      'Clinica',
      'Data Sessao',
      'Hora Inicio'
    ]

    const csvContent = [
      headers.join(';'),
      ...data.map(log => [
        log.id,
        format(new Date(log.validated_at), 'dd/MM/yyyy HH:mm:ss'),
        log.validation_ip,
        `"${log.validation_ua?.replace(/"/g, '""')}"`,
        log.validation_geo?.lat || '',
        log.validation_geo?.lng || '',
        Math.round(log.validation_distance || 0),
        log.is_out_of_range ? 'SIM' : 'NAO',
        `"${log.attendance?.patient?.name || ''}"`,
        `"${log.attendance?.professional?.name || ''}"`,
        `"${log.attendance?.clinic?.name || ''}"`,
        log.session_date,
        log.start_time
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
