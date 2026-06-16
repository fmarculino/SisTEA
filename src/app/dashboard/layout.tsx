import { getUserProfile, getActiveTerm, hasAcceptedTerm } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { TermAcceptanceModal } from '@/components/layout/TermAcceptanceModal'

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

  const activeTerm = await getActiveTerm()
  let needsAcceptance = false
  if (activeTerm) {
    needsAcceptance = !(await hasAcceptedTerm(profile.id, activeTerm.id))
  }

  return (
    <>
      {needsAcceptance && activeTerm && (
        <TermAcceptanceModal activeTerm={activeTerm} />
      )}
      <DashboardShell 
        role={profile.role} 
        email={profile.email || ''} 
        clinicName={profile.clinic_name}
        clinicLogoUrl={profile.clinic_logo_url || undefined}
      >
        {children}
      </DashboardShell>
    </>
  )
}

