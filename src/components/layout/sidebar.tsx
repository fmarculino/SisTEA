'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Activity, Users, UserSquare2, Building2, Stethoscope, FileText, 
  CalendarCheck, FileOutput, Shield, Lock, DatabaseBackup, 
  ScrollText, Archive, ShieldCheck, Settings, Database, 
  ClipboardList, ChevronDown, LayoutDashboard
} from 'lucide-react'
import { AboutMenu } from './about-menu'

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    roles: ['SMS_ADMIN', 'CLINIC_USER'] 
  },
  {
    name: 'Operação',
    icon: ClipboardList,
    roles: ['SMS_ADMIN', 'CLINIC_USER'],
    children: [
      { name: 'Frequências', href: '/dashboard/attendances', icon: CalendarCheck, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
      { name: 'Competências', href: '/dashboard/competences', icon: Archive, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
    ]
  },
  {
    name: 'Cadastros',
    icon: Database,
    roles: ['SMS_ADMIN', 'CLINIC_USER'],
    children: [
      { name: 'Pacientes', href: '/dashboard/patients', icon: Users, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
      { name: 'Profissionais', href: '/dashboard/professionals', icon: UserSquare2, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
      { name: 'Clínicas', href: '/dashboard/clinics', icon: Building2, roles: ['SMS_ADMIN'] },
      { name: 'Contratos', href: '/dashboard/contracts', icon: ScrollText, roles: ['SMS_ADMIN'] },
      { name: 'Procedimentos', href: '/dashboard/procedures', icon: Stethoscope, roles: ['SMS_ADMIN'] },
      { name: 'Especialidades', href: '/dashboard/specialties', icon: FileText, roles: ['SMS_ADMIN'] },
    ]
  },
  {
    name: 'Auditoria & Gestão',
    icon: ShieldCheck,
    roles: ['SMS_ADMIN'],
    children: [
      { name: 'Auditoria Digital', href: '/dashboard/audit', icon: ShieldCheck, roles: ['SMS_ADMIN'] },
      { name: 'Relatórios', href: '/dashboard/reports', icon: FileOutput, roles: ['SMS_ADMIN'] },
    ]
  },
  {
    name: 'Sistema',
    icon: Settings,
    roles: ['SMS_ADMIN', 'CLINIC_USER'],
    children: [
      { name: 'Configurações', href: '/dashboard/settings', icon: Settings, roles: ['SMS_ADMIN'] },
      { name: 'Usuários', href: '/dashboard/users', icon: Shield, roles: ['SMS_ADMIN'] },
      { name: 'Backup', href: '/dashboard/backup', icon: DatabaseBackup, roles: ['SMS_ADMIN'] },
      { name: 'Segurança', href: '/auth/update-password', icon: Lock, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
    ]
  }
]

export function Sidebar({ role, onLinkClick }: { role: string; onLinkClick?: () => void }) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>([])

  // Auto-expand group if a child is active
  useEffect(() => {
    const activeGroup = navigation.find(item => 
      item.children?.some(child => pathname.startsWith(child.href))
    )
    if (activeGroup && !openGroups.includes(activeGroup.name)) {
      setOpenGroups(prev => [...prev, activeGroup.name])
    }
  }, [pathname])

  const toggleGroup = (name: string) => {
    setOpenGroups(prev => 
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    )
  }

  const isGroupVisible = (item: any) => {
    if (item.children) {
      return item.children.some((child: any) => child.roles.includes(role))
    }
    return item.roles.includes(role)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-r border-border/40 bg-card/50 backdrop-blur-xl no-scrollbar">
      <div className="flex h-24 shrink-0 items-center px-8 mb-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary shadow-lg shadow-primary/20 mr-4 group/logo cursor-pointer transition-transform active:scale-95">
          <Activity className="h-7 w-7 text-primary-foreground group-hover/logo:scale-110 transition-transform duration-300" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent tracking-tighter leading-none">
            SisTEA
          </span>
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1 opacity-80">
            Inteligência
          </span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.filter(isGroupVisible).map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.name)
            const hasActiveChild = item.children.some(child => pathname.startsWith(child.href))
            const visibleChildren = item.children.filter(child => child.roles.includes(role))

            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleGroup(item.name)}
                  className={`
                    w-full group flex items-center justify-between px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300
                    ${hasActiveChild ? 'text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                  `}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-4 h-4.5 w-4.5 ${hasActiveChild ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                  <div className="ml-4 pl-4 border-l border-border/40 space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {visibleChildren.map((child) => {
                      const isActive = pathname === child.href
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={onLinkClick}
                          className={`
                            group flex items-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all
                            ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/30'}
                          `}
                        >
                          <child.icon className={`mr-3 h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          {child.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href!}
              onClick={onLinkClick}
              className={`
                group flex items-center px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300
                ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
              `}
            >
              <item.icon className={`mr-4 h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-4 pb-4">
        <AboutMenu />
      </div>

      <div className="p-4 border-t border-border/20">
        <div className="bg-muted/20 p-4 rounded-2xl border border-border/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black text-foreground uppercase tracking-widest truncate">{role === 'SMS_ADMIN' ? 'Secretaria' : 'Clínica'}</span>
              <span className="text-[9px] text-muted-foreground font-medium truncate opacity-50">Sessão Segura</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
