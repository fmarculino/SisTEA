'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Users, UserSquare2, Building2, Stethoscope, FileText, CalendarCheck, FileOutput, Shield } from 'lucide-react'
import { AboutMenu } from './about-menu'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Activity, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
  { name: 'Frequências', href: '/dashboard/attendances', icon: CalendarCheck, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
  { name: 'Pacientes', href: '/dashboard/patients', icon: Users, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
  { name: 'Profissionais', href: '/dashboard/professionals', icon: UserSquare2, roles: ['SMS_ADMIN', 'CLINIC_USER'] },
  { name: 'Clínicas', href: '/dashboard/clinics', icon: Building2, roles: ['SMS_ADMIN'] },
  { name: 'Procedimentos', href: '/dashboard/procedures', icon: Stethoscope, roles: ['SMS_ADMIN'] },
  { name: 'Especialidades', href: '/dashboard/specialties', icon: FileText, roles: ['SMS_ADMIN'] },
  { name: 'Relatórios', href: '/dashboard/reports', icon: FileOutput, roles: ['SMS_ADMIN'] },
  { name: 'Usuários', href: '/dashboard/users', icon: Shield, roles: ['SMS_ADMIN'] },
]

export function Sidebar({ role, onLinkClick }: { role: string; onLinkClick?: () => void }) {
  const pathname = usePathname()

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(role)
  )

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-r border-border/40 bg-card/50 backdrop-blur-xl">
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
      
      <nav className="flex-1 space-y-2 px-6 py-6">
        <div className="mb-4">
          <p className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 opacity-50">Menu Principal</p>
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onLinkClick}
                className={`
                  group relative flex items-center px-4 py-3.5 text-xs font-black uppercase tracking-widest rounded-2xl transition-all duration-300
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }
                `}
              >
                <item.icon
                  className={`
                    mr-4 h-5 w-5 flex-shrink-0 transition-all duration-300
                    ${
                      isActive
                        ? 'text-primary-foreground scale-110'
                        : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                    }
                  `}
                  aria-hidden="true"
                />
                <span className="relative z-10">{item.name}</span>
                {isActive && (
                  <div className="absolute -left-1 h-6 w-2 bg-primary rounded-full blur-sm opacity-50" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="mt-auto px-4 pb-4">
        <AboutMenu />
      </div>

      <div className="p-8 border-t border-border/20">
        <div className="bg-muted/30 p-4 rounded-2xl border border-border/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black text-foreground uppercase tracking-widest truncate">Acesso {role === 'SMS_ADMIN' ? 'Admin' : 'Clínica'}</span>
              <span className="text-[9px] text-muted-foreground font-medium truncate opacity-60">Sessão Segura Ativa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
