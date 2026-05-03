'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Clock, QrCode, RefreshCw, CheckCircle2 } from 'lucide-react'
import { generateValidationLinkAction, checkSessionStatusAction } from './actions'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

interface QRCodeModalProps {
  sessionId: string
  sessionIndex: number
  attendanceId: string
  patientName: string
  sessionDate: string
  onClose: () => void
}

const QR_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export function QRCodeModal({
  sessionId,
  sessionIndex,
  attendanceId,
  patientName,
  sessionDate,
  onClose,
}: QRCodeModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [validationUrl, setValidationUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState<number>(QR_EXPIRY_MS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validated, setValidated] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const generateQR = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await generateValidationLinkAction(attendanceId, sessionId)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.url) {
        setValidationUrl(result.url)
        // Use a third-party QR Code API (no npm dependency needed)
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}&bgcolor=ffffff&color=000000&margin=2`
        setQrUrl(qrImageUrl)
        const expiry = Date.now() + QR_EXPIRY_MS
        setExpiresAt(expiry)
        setTimeLeft(QR_EXPIRY_MS)
      }
    } catch (err) {
      setError('Erro ao gerar QR Code. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [attendanceId, sessionId])

  useEffect(() => {
    generateQR()
  }, [generateQR])

  // Countdown timer
  useEffect(() => {
    if (expiresAt === 0) return
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        setTimeLeft(0)
        clearInterval(interval)
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const isExpired = timeLeft <= 0 && expiresAt > 0
  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  // Polling for status change
  useEffect(() => {
    if (validated || isExpired || loading || error) return

    const pollInterval = setInterval(async () => {
      try {
        const result = await checkSessionStatusAction(sessionId)
        if (result.status === 'Realizada') {
          setValidated(true)
          clearInterval(pollInterval)
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [sessionId, validated, isExpired, loading, error])

  const handleClose = useCallback(() => {
    if (validated) {
      router.refresh()
    }
    onClose()
  }, [validated, router, onClose])

  if (!mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/60 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-3">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-wider">
            Solicitar Assinatura
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Peça ao paciente/responsável para escanear o QR Code com o celular
          </p>
        </div>

        {/* Patient info */}
        <div className="bg-muted/20 rounded-2xl p-4 mb-6 border border-border/40">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Paciente</p>
          <p className="text-sm font-bold text-foreground mt-1">{patientName}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sessão: {new Date(sessionDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[280px] h-[280px] rounded-2xl bg-muted/20 border-2 border-dashed border-border/60 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Gerando QR Code...</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-[280px] h-[280px] rounded-2xl bg-rose-500/5 border-2 border-dashed border-rose-500/20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <p className="text-sm text-rose-500 font-bold">{error}</p>
                <button
                  onClick={generateQR}
                  className="text-xs font-bold text-primary underline hover:no-underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : isExpired ? (
            <div className="w-[280px] h-[280px] rounded-2xl bg-amber-500/5 border-2 border-dashed border-amber-500/20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <Clock className="w-8 h-8 text-amber-500" />
                <p className="text-sm text-amber-600 font-bold">QR Code expirado</p>
                <button
                  onClick={generateQR}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Gerar Novo
                </button>
              </div>
            </div>
          ) : validated ? (
            <div className="w-[280px] h-[280px] rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center animate-in zoom-in duration-500">
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Sucesso!</p>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">Sessão validada e assinada digitalmente.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-600/10"
                >
                  Fechar e Atualizar
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-border/20">
              <img
                src={qrUrl!}
                alt="QR Code de validação"
                width={300}
                height={300}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Timer */}
          {!loading && !error && !isExpired && !validated && (
            <div className="flex items-center gap-2 mt-4 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className={`font-mono font-bold ${timeLeft < 60000 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground text-xs">restantes</span>
            </div>
          )}
        </div>

        {/* Footer instruction */}
        <p className="text-[10px] text-center text-muted-foreground mt-6 leading-relaxed">
          O paciente/responsável precisará informar o <strong>Token de 6 dígitos</strong> fornecido 
          pela administração para confirmar o atendimento.
        </p>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
