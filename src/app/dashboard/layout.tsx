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

  return (
    <DashboardShell role={profile.role} email={profile.email || ''}>
      {children}
    </DashboardShell>
  )
}
