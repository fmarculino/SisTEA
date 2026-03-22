'use client'

import { useState, useRef } from 'react'
import { Download, Upload, ShieldAlert, CheckCircle2, XCircle, Loader2, FileJson, AlertTriangle } from 'lucide-react'
import JSZip from 'jszip'

type BackupMeta = {
  app: string
  version: string
  backup_date: string
  total_records: number
  tables: Record<string, number>
}

type RestoreResult = {
  success?: boolean
  message?: string
  error?: string
  details?: string[]
  results?: Record<string, number>
  backup_date?: string
}

export function BackupManager() {
  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileMeta, setFileMeta] = useState<BackupMeta | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Backup ────────────────────────────────────────────
  async function handleBackup() {
    setIsBackingUp(true)
    setBackupSuccess(null)
    setBackupError(null)

    try {
      const response = await fetch('/api/backup')

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao gerar backup')
      }

      // Trigger download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `sistea-backup-${date}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setBackupSuccess(`Backup gerado com sucesso em ${new Date().toLocaleString('pt-BR')}`)
    } catch (err: any) {
      setBackupError(err.message || 'Erro ao gerar backup')
    } finally {
      setIsBackingUp(false)
    }
  }

  // ── File Selection ────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    setFileMeta(null)
    setRestoreResult(null)
    setConfirmText('')

    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip') && !file.name.endsWith('.json')) {
      setFileError('Selecione um arquivo .zip ou .json')
      return
    }

    try {
      let parsed: any

      if (file.name.endsWith('.zip')) {
        const arrayBuffer = await file.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuffer)
        const jsonFile = Object.keys(zip.files).find(name => name.endsWith('.json'))
        if (!jsonFile) {
          setFileError('O arquivo ZIP não contém nenhum arquivo .json')
          return
        }
        const text = await zip.files[jsonFile].async('string')
        parsed = JSON.parse(text)
      } else {
        const text = await file.text()
        parsed = JSON.parse(text)
      }

      if (!parsed.meta || parsed.meta.app !== 'SisTEA') {
        setFileError('Este arquivo não é um backup válido do SisTEA')
        return
      }

      if (!parsed.data) {
        setFileError('Arquivo de backup não contém seção de dados')
        return
      }

      setSelectedFile(file)
      setFileMeta(parsed.meta)
    } catch {
      setFileError('Arquivo inválido: não é um JSON válido')
    }
  }

  // ── Restore ───────────────────────────────────────────
  async function handleRestore() {
    if (!selectedFile || confirmText !== 'RESTAURAR') return

    setIsRestoring(true)
    setRestoreResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      setRestoreResult(result)

      if (result.success) {
        setSelectedFile(null)
        setFileMeta(null)
        setConfirmText('')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setRestoreResult({ error: err.message || 'Erro ao restaurar backup' })
    } finally {
      setIsRestoring(false)
    }
  }

  function resetFileInput() {
    setSelectedFile(null)
    setFileMeta(null)
    setFileError(null)
    setConfirmText('')
    setRestoreResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Card: Criar Backup ─────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Criar Backup</h2>
            <p className="text-xs text-muted-foreground">Exportar todos os dados do sistema</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Gera um arquivo ZIP compactado contendo todos os dados cadastrais, frequências, profissionais, pacientes e configurações do sistema.
        </p>

        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBackingUp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando backup...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Gerar e Baixar Backup
            </>
          )}
        </button>

        {backupSuccess && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">{backupSuccess}</p>
          </div>
        )}

        {backupError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400">{backupError}</p>
          </div>
        )}
      </div>

      {/* ── Card: Restaurar Backup ─────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
            <Upload className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-base font-bold">Restaurar Backup</h2>
            <p className="text-xs text-muted-foreground">Importar dados de um backup anterior</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700 dark:text-orange-400">
            <strong>Atenção:</strong> A restauração irá <strong>substituir todos os dados atuais</strong> pelos dados do backup. Esta ação não pode ser desfeita. Recomenda-se criar um backup antes de restaurar.
          </p>
        </div>

        {/* File input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Selecionar arquivo de backup (.zip)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileSelect}
            disabled={isRestoring}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-muted file:text-foreground hover:file:bg-muted/80 file:cursor-pointer file:transition-colors disabled:opacity-50"
          />
        </div>

        {fileError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-4">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400">{fileError}</p>
          </div>
        )}

        {/* File preview */}
        {fileMeta && (
          <div className="rounded-xl bg-muted/30 border border-border/40 p-4 mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold">Detalhes do Backup</span>
              <button 
                onClick={resetFileInput}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remover
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Data:</span>{' '}
                <span className="font-medium">
                  {new Date(fileMeta.backup_date).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Versão:</span>{' '}
                <span className="font-medium">{fileMeta.version}</span>
              </div>
              <div className="text-xs col-span-2">
                <span className="text-muted-foreground">Total de registros:</span>{' '}
                <span className="font-bold text-primary">{fileMeta.total_records}</span>
              </div>
            </div>

            <div className="border-t border-border/40 pt-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Registros por tabela</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(fileMeta.tables).map(([table, count]) => (
                  <div key={table} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50">
                    <span className="text-muted-foreground truncate">{table}</span>
                    <span className="font-mono font-bold ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation */}
            <div className="border-t border-border/40 pt-3">
              <label className="block text-xs text-muted-foreground mb-2">
                Para confirmar, digite <strong className="text-foreground">RESTAURAR</strong> no campo abaixo:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isRestoring}
                placeholder="Digite RESTAURAR"
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-mono tracking-widest focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleRestore}
              disabled={isRestoring || confirmText !== 'RESTAURAR'}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition-all hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restaurando dados...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Restaurar Backup
                </>
              )}
            </button>
          </div>
        )}

        {/* Restore result */}
        {restoreResult && (
          <div className={`mt-4 rounded-xl border p-4 ${
            restoreResult.success
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-start gap-2 mb-2">
              {restoreResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <p className={`text-xs font-bold ${
                restoreResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}>
                {restoreResult.success ? restoreResult.message : restoreResult.error}
              </p>
            </div>

            {restoreResult.results && (
              <div className="grid grid-cols-2 gap-1 mt-3">
                {Object.entries(restoreResult.results).map(([table, count]) => (
                  <div key={table} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-background/50">
                    <span className="text-muted-foreground truncate">{table}</span>
                    <span className="font-mono font-bold ml-2">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {restoreResult.details && restoreResult.details.length > 0 && (
              <div className="mt-3 space-y-1">
                {restoreResult.details.map((detail, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">{detail}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
