import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ScrollText } from 'lucide-react'
import { TermListClient } from './TermListClient'

export const dynamic = 'force-dynamic'

export default async function TermsPage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Fetch all versions
  const { data: terms } = await supabase
    .from('terms_versions')
    .select('*')
    .order('created_at', { ascending: false })

  // Query counts of acceptances for each version
  const termsWithCounts = await Promise.all(
    (terms || []).map(async (t) => {
      const { count } = await supabase
        .from('terms_acceptances')
        .select('*', { count: 'exact', head: true })
        .eq('term_version_id', t.id)
      return { 
        ...t, 
        acceptCount: count || 0,
        // serialize fields
        created_at: t.created_at.toString()
      }
    })
  )

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl">
            Termos de <span className="text-primary tracking-tighter">Confidencialidade</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerencie as versões do termo de confidencialidade e aceite digital exigidos dos usuários no primeiro acesso.
          </p>
        </div>
        <Link
          href="/dashboard/settings/terms/new"
          className="inline-flex items-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/10 transition-all active:scale-95 group uppercase tracking-widest"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5 stroke-[3]" aria-hidden="true" />
          Nova Versão
        </Link>
      </div>

      <TermListClient initialTerms={termsWithCounts} />
    </div>
  )
}
