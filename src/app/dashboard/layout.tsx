import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

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
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      <Sidebar role={profile.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header email={profile.email || ''} role={profile.role} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
