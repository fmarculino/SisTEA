import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getUserProfile()

  if (!profile) {
    redirect('/login')
  }

  if (profile.active === false) {
    redirect('/login?error=Seu usuário está desativado. Entre em contato com o suporte.')
  }

  if (!profile.clinic_active) {
    redirect('/login?error=Esta clínica está desativada. O acesso foi bloqueado.')
  }

  return (
    <DashboardShell 
      role={profile.role} 
      email={profile.email || ''} 
      clinicName={profile.clinic_name}
    >
      {children}
    </DashboardShell>
  )
}
