'use client'

import { useState, useTransition } from 'react'
import { 
  ShieldAlert, RefreshCw, MapPin, 
  ClipboardList, Activity, Lock, 
  Clock, Globe, Save, Loader2,
  Settings, Image as ImageIcon
} from 'lucide-react'
import { updateAllSettingsAction } from './actions'
import { useRouter } from 'next/navigation'
import { StatusModal } from '@/components/ui/StatusModal'
import { createClient } from '@/utils/supabase/client'

interface SettingsFormProps {
  initialSettings: any[]
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [showStatus, setShowStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // State for all settings
  const [values, setValues] = useState(() => {
    const obj: Record<string, any> = {}
    initialSettings.forEach(s => {
      obj[s.key] = s.value
    })
    // Ensure defaults
    if (obj['enable_token_rotation'] === undefined) obj['enable_token_rotation'] = false
    if (obj['allow_future_attendances'] === undefined) obj['allow_future_attendances'] = true
    if (obj['geofencing_threshold_meters'] === undefined) obj['geofencing_threshold_meters'] = 100
    if (obj['signature_window_hours'] === undefined) obj['signature_window_hours'] = 1
    if (obj['system_timezone'] === undefined) obj['system_timezone'] = 'America/Sao_Paulo'
    if (obj['system_timezone_offset'] === undefined) obj['system_timezone_offset'] = '-03:00'
    return obj
  })

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    startTransition(async () => {
      const result = await updateAllSettingsAction(values)
      if (result.success) {
        setShowStatus({ type: 'success', message: 'Configurações salvas com sucesso!' })
        router.refresh()
      } else {
        setShowStatus({ type: 'error', message: result.error || 'Erro ao salvar' })
      }
    })
  }

  return (
    <div className="space-y-10">
      {/* Header com Botão Salvar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4 border-b border-border/10 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
        <div>
          <h2 className="text-3xl font-black leading-tight text-foreground tracking-tight sm:text-4xl flex items-center gap-3">
            <Settings className="h-10 w-10 text-primary" />
            Configurações do <span className="text-primary tracking-tighter">Sistema</span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground font-medium max-w-xl">
            Gerencie o comportamento global do SisTEA.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-3 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:scale-100"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Salvar Alterações
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 max-w-4xl pb-10">
        {/* Identidade Visual Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <ImageIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Identidade Visual</h3>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="space-y-1 mb-6">
              <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Logo da Instituição (Prefeitura / SMS)
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Será exibida no topo da tela de login e na barra lateral do sistema.
              </p>
            </div>

            <div className="space-y-4">
              {values.instituicao_cabecalho_url ? (
                <div className="flex items-center gap-4 animate-in fade-in">
                  <div className="h-20 w-48 border-2 border-border/40 rounded-2xl overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] bg-[size:10px_10px] bg-muted/30 flex items-center justify-center p-2 shadow-inner">
                    <img 
                      src={values.instituicao_cabecalho_url} 
                      alt="Logo Instituição" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('instituicao_cabecalho_url', '')}
                    className="px-4 py-2 text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all uppercase tracking-wider"
                  >
                    Remover Imagem
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative group max-w-md animate-in fade-in duration-200">
                    <input
                      id="instituicao_cabecalho"
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml"
                      disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 1 * 1024 * 1024) {
                          setShowStatus({ type: 'error', message: 'A imagem deve ter no máximo 1MB.' })
                          return
                        }
                        setUploadingImage(true)
                        try {
                          const fileExt = file.name.split('.').pop()
                          const fileName = `instituicao_cabecalho.${fileExt}`
                          const { error: uploadError } = await supabase.storage
                            .from('logos')
                            .upload(fileName, file, { contentType: file.type, upsert: true })
                          if (uploadError) {
                            setShowStatus({ type: 'error', message: 'Erro no upload: ' + uploadError.message })
                            return
                          }
                          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
                          handleChange('instituicao_cabecalho_url', publicUrl)
                        } catch (err: any) {
                          setShowStatus({ type: 'error', message: 'Erro ao processar: ' + err.message })
                        } finally {
                          setUploadingImage(false)
                        }
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-2 file:border-dashed file:border-border/60 file:text-sm file:font-bold file:bg-primary/5 file:text-primary hover:file:bg-primary/10 file:transition-all cursor-pointer disabled:opacity-50"
                    />
                    {uploadingImage && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Processando...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                    Recomendado: PNG com fundo transparente. Resolução máxima sugerida: 400x120px (máx. 1MB).
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

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
                </p>
              </div>

              <button
                onClick={() => handleChange('enable_token_rotation', !values.enable_token_rotation)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${values.enable_token_rotation ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${values.enable_token_rotation ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="mt-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${values.enable_token_rotation ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                Status: {values.enable_token_rotation ? 'ATIVADO' : 'DESATIVADO (Padrão)'}
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
                  Define a distância máxima permitida (em metros) entre o dispositivo do responsável e a clínica.
                </p>
              </div>

              <div className="relative">
                <input
                  type="number"
                  value={values.geofencing_threshold_meters}
                  onChange={(e) => handleChange('geofencing_threshold_meters', e.target.value)}
                  className="w-32 px-3 py-1 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">m</span>
              </div>
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
                  Permite registrar atendimentos com data posterior à data atual.
                </p>
              </div>

              <button
                onClick={() => handleChange('allow_future_attendances', !values.allow_future_attendances)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${values.allow_future_attendances ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${values.allow_future_attendances ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="mt-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${values.allow_future_attendances ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                Status: {values.allow_future_attendances ? 'PERMITIDO (Padrão)' : 'BLOQUEADO'}
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
                  Intervalo permitido para assinatura do paciente (horas antes/depois).
                </p>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={values.signature_window_hours}
                  onChange={(e) => handleChange('signature_window_hours', e.target.value)}
                  className="w-32 px-3 py-1 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">h</span>
              </div>
            </div>
          </div>
        </section>

        {/* Localização e Tempo Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <Globe className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Localização e Tempo</h3>
          </div>

          <div className="bento-card p-6 group hover:border-primary/30 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Fuso Horário
                </label>
                <input
                  type="text"
                  value={values.system_timezone}
                  onChange={(e) => handleChange('system_timezone', e.target.value)}
                  placeholder="America/Sao_Paulo"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Globe className="h-3 w-3" /> Deslocamento UTC
                </label>
                <input
                  type="text"
                  value={values.system_timezone_offset}
                  onChange={(e) => handleChange('system_timezone_offset', e.target.value)}
                  placeholder="-03:00"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {showStatus && (
        <StatusModal
          isOpen={!!showStatus}
          type={showStatus.type}
          title={showStatus.type === 'success' ? 'Sucesso' : 'Erro'}
          message={showStatus.message}
          onClose={() => setShowStatus(null)}
        />
      )}
    </div>
  )
}
