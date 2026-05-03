'use client'

import { useState, useRef, useEffect } from 'react'

interface SessionInfo {
  sessionId: string
  sessionDate: string
  startTime: string
  endTime: string
  status: string
  alreadyValidated: boolean
  patientName: string
  professionalName: string
  procedureName: string
}

export function ValidationClient({
  sessionInfo,
  hmac,
  timestamp,
}: {
  sessionInfo: SessionInfo
  hmac: string
  timestamp: string
}) {
  const [tokenDigits, setTokenDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [blocked, setBlocked] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only digits

    const newDigits = [...tokenDigits]
    newDigits[index] = value.slice(-1) // Only last character
    setTokenDigits(newDigits)

    // Auto-advance to next field
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !tokenDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newDigits = [...tokenDigits]
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i]
    }
    setTokenDigits(newDigits)
    // Focus last filled or first empty
    const focusIndex = Math.min(pastedData.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }

  const handleSubmit = async () => {
    const token = tokenDigits.join('')
    if (token.length !== 6) {
      setError('Digite todos os 6 dígitos do token.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Try to get geolocation (optional, non-blocking)
      let geo: { lat: number; lng: number; accuracy: number } | null = null
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 3000,
            enableHighAccuracy: false,
          })
        })
        geo = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      } catch {
        // Geolocation not available or denied — proceed without it
      }

      const response = await fetch('/api/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionInfo.sessionId,
          token,
          hmac,
          timestamp: Number(timestamp),
          geo,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Erro ao validar')
        if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining)
        }
        if (result.blocked) {
          setBlocked(true)
        }
        // Clear token on error
        setTokenDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // Already validated state
  if (sessionInfo.alreadyValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-gray-950 to-gray-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Já Validada</h1>
          <p className="text-emerald-400 text-sm">
            Esta sessão já foi validada anteriormente.
          </p>
          <div className="mt-6 bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/60 text-xs">Paciente</p>
            <p className="text-white font-bold">{sessionInfo.patientName}</p>
            <p className="text-white/60 text-xs mt-2">Data</p>
            <p className="text-white font-bold">{formatDate(sessionInfo.sessionDate)}</p>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-gray-950 to-gray-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center animate-in zoom-in-95 fade-in duration-500">
          <div className="w-24 h-24 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <span className="text-5xl">✅</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Confirmado!</h1>
          <p className="text-emerald-400 text-base font-medium">
            Sessão validada com sucesso.
          </p>
          <div className="mt-8 bg-white/5 rounded-2xl p-5 border border-emerald-500/20">
            <p className="text-white/60 text-xs uppercase tracking-widest">Paciente</p>
            <p className="text-white font-bold text-lg">{sessionInfo.patientName}</p>
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/60 text-xs">Data</p>
                <p className="text-white font-bold text-sm">{formatDate(sessionInfo.sessionDate)}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Horário</p>
                <p className="text-white font-bold text-sm">{sessionInfo.startTime} - {sessionInfo.endTime}</p>
              </div>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-6">Você pode fechar esta página.</p>
        </div>
      </div>
    )
  }

  // Main validation form
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-gray-950 to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-sky-500/20 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">🏥</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Sis<span className="text-sky-400">TEA</span>
          </h1>
          <p className="text-white/50 text-sm mt-1">Validação de Atendimento</p>
        </div>

        {/* Session Info Card */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Paciente</p>
              <p className="text-white font-bold">{sessionInfo.patientName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Data</p>
                <p className="text-white font-bold text-sm">{formatDate(sessionInfo.sessionDate)}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Horário</p>
                <p className="text-white font-bold text-sm">{sessionInfo.startTime} - {sessionInfo.endTime}</p>
              </div>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Profissional</p>
              <p className="text-white font-bold text-sm">{sessionInfo.professionalName}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Procedimento</p>
              <p className="text-white/80 text-sm">{sessionInfo.procedureName}</p>
            </div>
          </div>
        </div>

        {/* Token Input */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-4">
          <p className="text-white/70 text-sm text-center mb-5 font-medium">
            Digite o token de <strong className="text-sky-400">6 dígitos</strong> fornecido pela administração:
          </p>

          <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
            {tokenDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading || blocked}
                className="w-12 h-14 text-center text-2xl font-mono font-black text-white bg-white/10 border-2 border-white/20 rounded-xl focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 outline-none transition-all disabled:opacity-50"
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-rose-400 text-sm text-center font-medium">{error}</p>
            </div>
          )}

          {/* Attempts remaining */}
          {attemptsRemaining !== null && attemptsRemaining > 0 && (
            <p className="text-amber-400/80 text-xs text-center mb-4">
              ⚠️ Tentativas restantes: {attemptsRemaining}
            </p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading || blocked || tokenDigits.join('').length !== 6}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 disabled:text-white/30 text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validando...
              </span>
            ) : blocked ? (
              'Bloqueado — Solicite novo QR Code'
            ) : (
              '✓ Confirmar Atendimento'
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-white/20 text-[10px] text-center leading-relaxed">
          Ao confirmar, você atesta que o atendimento descrito acima foi realizado.
          <br />
          SisTEA — Sistema de Terapia Especializada em Autismo
        </p>
      </div>
    </div>
  )
}
