'use client'

import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'error' | 'success' | 'warning' | 'info'
}

export function StatusModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'error'
}: StatusModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const config = {
    error: {
      icon: <AlertCircle className="w-12 h-12 text-rose-500" />,
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20',
      titleColor: 'text-rose-600 dark:text-rose-400'
    },
    success: {
      icon: <CheckCircle2 className="w-12 h-12 text-emerald-500" />,
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
      titleColor: 'text-emerald-600 dark:text-emerald-400'
    },
    warning: {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
      titleColor: 'text-amber-600 dark:text-amber-400'
    },
    info: {
      icon: <Info className="w-12 h-12 text-blue-500" />,
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
      titleColor: 'text-blue-600 dark:text-blue-400'
    }
  }

  const { icon, bg, border, button, titleColor } = config[type]

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border/60 rounded-[2rem] shadow-2xl p-8 max-w-sm w-full relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden"
      >
        {/* Background Accent */}
        <div className={`absolute top-0 left-0 w-full h-1 ${config[type].button.split(' ')[0]}`} />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-3xl ${bg} ${border} mb-6`}>
            {icon}
          </div>

          <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${titleColor}`}>
            {title}
          </h3>
          
          <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">
            {message}
          </p>

          <button
            onClick={onClose}
            className={`w-full py-4 rounded-2xl text-white font-bold transition-all active:scale-95 shadow-lg ${button}`}
          >
            ENTENDI
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
