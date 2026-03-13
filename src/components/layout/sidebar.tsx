'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Users, UserSquare2, Building2, Stethoscope, FileText, CalendarCheck, FileOutput, Shield } from 'lucide-react'

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

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(role)
  )

  return (
    <div className="flex h-full w-64 flex-col overflow-y-auto border-r border-border bg-background">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Activity className="h-8 w-8 text-primary" />
        <span className="ml-3 text-xl font-bold text-foreground">SisTEA</span>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md
                ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <item.icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }
                `}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
