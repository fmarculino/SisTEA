'use client'

import { Info, HelpCircle } from 'lucide-react'
import packageJson from '../../../package.json'

export function AboutMenu() {
  const version = packageJson.version

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        <HelpCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Ajuda</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        <Info className="h-4 w-4 group-hover:scale-110 transition-transform" />
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest">Sobre o Sistema</span>
          <span className="text-[9px] font-medium opacity-60">Versão: {version}</span>
        </div>
      </div>
    </div>
  )
}
