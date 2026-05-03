import { createClient } from '@/utils/supabase/server'
import { getUserProfile } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { Settings, ShieldAlert, RefreshCw, MapPin, ClipboardList, Activity, Lock } from 'lucide-react'
import { updateSystemSettingAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await getUserProfile()
  if (profile?.role !== 'SMS_ADMIN') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .order('key')

  const rotationEnabled = settings?.find(s => s.key === 'enable_token_rotation')?.value
  const allowFuture = settings?.find(s => s.key === 'allow_future_attendances')?.value ?? true
  const signatureWindow = settings?.find(s => s.key === 'signature_window_hours')?.value ?? 2

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl flex items-center gap-3">
            <Settings className="h-10 w-10 text-primary" />
            Configurações do <span className="text-primary tracking-tighter">Sistema</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerencie o comportamento global do SisTEA. Alterações aqui afetam todos os usuários e clínicas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 max-w-4xl">
        {/* Auditoria & Segurança Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Segurança e Auditoria</h3>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Rotação Automática de Token
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quando ativado, o código (token) do paciente será alterado automaticamente após cada assinatura bem-sucedida via QR Code. 
                  Isso aumenta a segurança, mas exige que a família obtenha um novo código para a próxima sessão.
                </p>
              </div>
              
              <form action={async (formData) => {
                'use server'
                await updateSystemSettingAction(formData)
              }}>
                <input type="hidden" name="key" value="enable_token_rotation" />
                <input type="hidden" name="value" value={rotationEnabled === 'true' || rotationEnabled === true ? 'false' : 'true'} />
                <button
                  type="submit"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    rotationEnabled === 'true' || rotationEnabled === true ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      rotationEnabled === 'true' || rotationEnabled === true ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </form>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                rotationEnabled === 'true' || rotationEnabled === true ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                Status: {rotationEnabled === 'true' || rotationEnabled === true ? 'ATIVADO' : 'DESATIVADO (Padrão)'}
              </span>
            </div>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Limite de Geofencing (Raio de Validação)
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Define a distância máxima permitida (em metros) entre o dispositivo do responsável e a clínica para que a assinatura não seja marcada como "Remota".
                </p>
              </div>
              
              <form action={async (formData) => {
                'use server'
                await updateSystemSettingAction(formData)
              }} className="flex items-center gap-2">
                <input type="hidden" name="key" value="geofencing_threshold_meters" />
                <div className="relative">
                  <input 
                    type="number" 
                    name="value"
                    defaultValue={settings?.find(s => s.key === 'geofencing_threshold_meters')?.value || 500}
                    className="w-24 px-3 py-1 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">m</span>
                </div>
                <button
                  type="submit"
                  className="px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </form>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Valor Atual: {settings?.find(s => s.key === 'geofencing_threshold_meters')?.value || 500} metros
              </span>
            </div>
          </div>
        </section>

        {/* Regras de Operação Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <ClipboardList className="h-5 w-5 text-sky-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Regras de Operação</h3>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Permitir Atendimento Futuro
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quando ativado, o sistema permite registrar atendimentos com data posterior à data atual. 
                  Se desativado, apenas atendimentos retroativos ou do dia atual serão permitidos.
                </p>
              </div>
              
              <form action={async (formData) => {
                'use server'
                await updateSystemSettingAction(formData)
              }}>
                <input type="hidden" name="key" value="allow_future_attendances" />
                <input type="hidden" name="value" value={allowFuture === 'true' || allowFuture === true ? 'false' : 'true'} />
                <button
                  type="submit"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    allowFuture === 'true' || allowFuture === true ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      allowFuture === 'true' || allowFuture === true ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </form>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                allowFuture === 'true' || allowFuture === true ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                Status: {allowFuture === 'true' || allowFuture === true ? 'PERMITIDO (Padrão)' : 'BLOQUEADO'}
              </span>
            </div>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Janela de Assinatura (Horário)
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Intervalo permitido para assinatura do paciente em relação ao horário marcado. 
                  Ex: Se definido 2 horas, a assinatura só será aceita entre 2h antes e 2h depois do início da sessão.
                </p>
              </div>
              
              <form action={async (formData) => {
                'use server'
                await updateSystemSettingAction(formData)
              }} className="flex items-center gap-2">
                <input type="hidden" name="key" value="signature_window_hours" />
                <div className="relative">
                  <input 
                    type="number" 
                    name="value"
                    step="0.5"
                    defaultValue={signatureWindow}
                    className="w-24 px-3 py-1 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">h</span>
                </div>
                <button
                  type="submit"
                  className="px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </form>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Janela: {signatureWindow} horas (antes/depois)
              </span>
            </div>
          </div>
        </section>

        {/* Informational Box */}
        <div className="bg-muted/30 rounded-2xl p-6 border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            * Nota: Novas configurações serão adicionadas a este menu conforme a evolução do sistema, 
            incluindo limites de geofencing, prazos de competência globais e regras de faturamento.
          </p>
        </div>
      </div>
    </div>
  )
}
