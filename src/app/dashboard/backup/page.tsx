import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { BackupManager } from './BackupManager'

export default async function BackupPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Backup e Recuperação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie cópias de segurança dos dados do sistema e restaure quando necessário
        </p>
      </div>
      <BackupManager />
    </div>
  )
}
