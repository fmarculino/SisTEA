'use client'

import { Info, X, Activity, Github, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import packageJson from '../../../package.json'

export function AboutMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const version = packageJson.version

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 min-h-screen w-screen overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-border/50 bg-card shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
        
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted/50 transition-colors z-10"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="relative p-10 pt-14 flex flex-col items-center">
          {/* Logo Area */}
          <div className="flex items-center justify-center h-24 w-24 rounded-[2rem] bg-primary shadow-2xl shadow-primary/30 mb-8 group cursor-default transition-all hover:scale-105 hover:rotate-3 duration-500">
            <Activity className="h-12 w-12 text-primary-foreground group-hover:scale-110 transition-transform duration-500" />
          </div>

          {/* Title & Version */}
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent tracking-tighter leading-none mb-3">
              SisTEA
            </h2>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  V 0.1.0 Verified
                </span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">
                Secure Architecture & Stable Release
              </span>
            </div>
          </div>

          {/* Main Text */}
          <div className="space-y-6 text-center mb-10 max-w-md">
            <p className="text-base text-foreground/90 leading-relaxed font-bold">
              Sistema inteligente de Gestão Integrada para acompanhamento Multiprofissional de Autismo e TDAH.
            </p>
            <div className="flex justify-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary/30" />
              <div className="h-1 w-8 rounded-full bg-primary/30" />
              <div className="h-1 w-1 rounded-full bg-primary/30" />
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-black leading-relaxed opacity-60">
              Desenhado para simplificar processos e potencializar o cuidado humanizado.
            </p>
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <a 
              href="https://github.com/fmarculino/SisTEA"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-muted/40 hover:bg-muted/60 text-foreground transition-all duration-300 group border border-border/20"
            >
              <Github className="h-5 w-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-widest">GitHib Source</span>
            </a>
            <button 
              onClick={() => setIsOpen(false)}
              className="px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/10"
            >
              Entendido
            </button>
          </div>
        </div>

        {/* Bottom Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50" />
      </div>
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-1 px-4 py-2 border-t border-border/10">
        <div 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 cursor-pointer group"
        >
          <Info className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest">Sobre o Sistema</span>
            <span className="text-[9px] font-medium opacity-60">Versão {version}</span>
          </div>
        </div>
      </div>

      {isOpen && mounted && createPortal(modal, document.body)}
    </>
  )
}
