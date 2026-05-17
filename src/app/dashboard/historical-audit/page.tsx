'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileUp, 
  Search, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  Table as TableIcon,
  ShieldCheck,
  History,
  Building2,
  Users,
  UserSquare2,
  Stethoscope,
  XCircle,
  AlertTriangle,
  Download,
  Calendar,
  X,
  Plus
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { createClient } from '@/utils/supabase/client'

export default function HistoricalAuditPage() {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'mapping' | 'matching' | 'validating' | 'completed'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [fullData, setFullData] = useState<any[][]>([])
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [importSource, setImportSource] = useState<'file' | 'google'>('file')
  const [googleUrl, setGoogleUrl] = useState('')
  const [clinics, setClinics] = useState<any[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [selectedCompetence, setSelectedCompetence] = useState<string>('')
  const [isCompetenceValid, setIsCompetenceValid] = useState<boolean>(true)

  // Função para formatar com máscara MM/AAAA e validar em tempo real
  const handleCompetenceChange = (val: string) => {
    const clean = val.replace(/\D/g, '')
    
    let formatted = ''
    if (clean.length > 0) {
      const digits = clean.slice(0, 6)
      
      if (digits.length <= 2) {
        formatted = digits
      } else {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`
      }
    }
    
    setSelectedCompetence(formatted)
    
    if (formatted === '') {
      setIsCompetenceValid(true)
    } else {
      const regex = /^(0[1-9]|1[0-2])\/\d{4}$/
      setIsCompetenceValid(regex.test(formatted))
    }
  }
  
  // Mapeamento de colunas
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [matchingStats, setMatchingStats] = useState({
    patients: { matched: 0, total: 0 },
    professionals: { matched: 0, total: 0 },
    clinics: { matched: 0, total: 0 },
    procedures: { matched: 0, total: 0 },
  })
  const [unresolvedRecords, setUnresolvedRecords] = useState<any[]>([])
  const [validationStats, setValidationStats] = useState({ validated: 0, errors: 0 })
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [resolutionData, setResolutionData] = useState({
    patient_id: '',
    professional_id: '',
    procedure_id: '',
    cid: '',
    service_classification_id: '',
    attendance_character: '01',
    session_date: '',
    start_time: '',
    end_time: '',
    auth_number: '',
    quantity: 1
  })

  // Estados para o Cadastro Rápido Ex-Officio (Fase 2)
  const [quickCreateType, setQuickCreateType] = useState<'patient' | 'professional' | null>(null)
  const [quickPatientData, setQuickPatientData] = useState({
    name: '',
    cns: '',
    birthDate: '',
    gender: 'N'
  })
  const [quickProfessionalData, setQuickProfessionalData] = useState({
    name: '',
    cns: '',
    cbo: ''
  })

  // Estados para Arbitragem Humana (Fase 3)
  const [arbitrationRecord, setArbitrationRecord] = useState<any | null>(null)
  const [arbitrationJustification, setArbitrationJustification] = useState('')
  const [isArbitrationModalOpen, setIsArbitrationModalOpen] = useState(false)

  const [options, setOptions] = useState<{
    patients: any[],
    professionals: any[],
    clinics: any[],
    procedures: any[],
    cids: any[],
    service_classifications: any[]
  }>({
    patients: [],
    professionals: [],
    clinics: [],
    procedures: [],
    cids: [],
    service_classifications: []
  })

  // Efeito para buscar opções globais
  useEffect(() => {
    fetchOptions()
    fetchClinics()
  }, [])

  const fetchOptions = async () => {
    const [pats, pros, clis, procs, cids, scs] = await Promise.all([
      supabase.from('patients').select('id, name').eq('active', true).order('name'),
      supabase.from('professionals').select('id, name').eq('active', true).order('name'),
      supabase.from('clinics').select('id, name').eq('active', true).order('name'),
      supabase.from('procedures').select('id, name, code').eq('active', true).order('name'),
      supabase.from('cids').select('id, name, code').eq('active', true).order('name'),
      supabase.from('service_classifications').select('id, name, code').eq('active', true).order('name')
    ])

    setOptions({
      patients: pats.data || [],
      professionals: pros.data || [],
      clinics: clis.data || [],
      procedures: (procs.data || []).map((p: any) => ({ ...p, name: `${p.code} - ${p.name}` })),
      cids: (cids.data || []).map((c: any) => ({ ...c, name: `${c.code} - ${c.name}` })),
      service_classifications: (scs.data || []).map((s: any) => ({ ...s, name: `${s.code} - ${s.name}` }))
    })
  }

  // Efeito para processar o matching automático
  useEffect(() => {
    if (step === 'matching' && currentBatchId) {
      runAutoMatching()
    }
  }, [step, currentBatchId])

  const runAutoMatching = async () => {
    setLoading(true)

    try {
      // 1. Chamar RPC de matching
      const { data: stats, error: rpcError } = await supabase
        .rpc('match_historical_records', { p_batch_id: currentBatchId })

      if (rpcError) throw rpcError

      // 2. Atualizar estatísticas
      setMatchingStats({
        patients: { matched: stats.patients, total: stats.total },
        professionals: { matched: stats.professionals, total: stats.total },
        clinics: { matched: stats.clinics, total: stats.total },
        procedures: { matched: stats.procedures, total: stats.total },
      })

      // 3. Buscar registros que ainda precisam de resolução
      const { data: records, error: fetchError } = await supabase
        .from('import_historical_records')
        .select('*')
        .eq('import_batch_id', currentBatchId)
        .eq('match_status', 'pending')
        .limit(50)

      if (fetchError) throw fetchError
      setUnresolvedRecords(records || [])

    } catch (err) {
      console.error('Erro no matching:', err)
      setError('Falha ao executar matching automático.')
    } finally {
      setLoading(false)
    }
  }

  const runValidation = async () => {
    setLoading(true)
    setStep('validating')

    try {
      const { data: stats, error: rpcError } = await supabase
        .rpc('validate_historical_records', { p_batch_id: currentBatchId })

      if (rpcError) throw rpcError
      setValidationStats(stats)

      // Se houver erros, buscar os registros com erros
      if (stats.errors > 0) {
        const { data: records } = await supabase
          .from('import_historical_records')
          .select('*')
          .eq('import_batch_id', currentBatchId)
          .eq('validation_status', 'glossed')
          .limit(50)
        
        setUnresolvedRecords(records || [])
      } else {
        setUnresolvedRecords([])
      }

    } catch (err) {
      console.error('Erro na validação:', err)
      setError('Falha ao executar validação de regras de negócio.')
    } finally {
      setLoading(false)
    }
  }

  const SISTEA_FIELDS = [
    { key: 'raw_patient_name', label: 'Nome do Paciente', required: true },
    { key: 'raw_patient_cns', label: 'CNS do Paciente', required: true },
    { key: 'raw_professional_name', label: 'Nome do Profissional', required: true },
    { key: 'raw_professional_identifier', label: 'CNS/CPF Profissional', required: true },
    { key: 'raw_procedure_code', label: 'Código Procedimento', required: true },
    { key: 'raw_session_date', label: 'Data do Atendimento', required: true },
    { key: 'raw_start_time', label: 'Hora Início', required: true },
    { key: 'raw_end_time', label: 'Hora Fim', required: true },
  ]

  const fetchClinics = async () => {
    const { data } = await supabase.from('clinics').select('id, name').eq('active', true).order('name')
    if (data) setClinics(data)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    if (!uploadedFile.name.endsWith('.xlsx') && !uploadedFile.name.endsWith('.xls')) {
      setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)')
      return
    }

    setFile(uploadedFile)
    setError(null)
    parseExcel(uploadedFile)
  }

  const parseExcel = (file: File) => {
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        
        if (json.length > 0) {
          const excelHeaders = json[0].map(h => String(h))
          setHeaders(excelHeaders)
          setPreviewData(json.slice(0, 21))
          setFullData(json)
          
          // Auto-mapping básico por nome aproximado
          const initialMappings: Record<string, string> = {}
          SISTEA_FIELDS.forEach(field => {
            const match = excelHeaders.find(h => 
              h.toLowerCase().includes(field.label.toLowerCase()) || 
              h.toLowerCase().includes(field.key.replace('raw_', '').toLowerCase())
            )
            if (match) initialMappings[field.key] = match
          })
          setMappings(initialMappings)
        }
        
        setLoading(false)
      } catch (err) {
        setError('Erro ao ler o arquivo Excel. Verifique se o formato está correto.')
        setLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleGoogleSheetsImport = async () => {
    if (!googleUrl) return
    if (!selectedClinicId) {
      setError('Selecione a clínica de destino antes de importar.')
      return
    }
    setLoading(true)

    try {
      // Extrair ID da planilha da URL
      const match = googleUrl.match(/[-\w]{25,}/)
      if (!match) {
        throw new Error('Link do Google Sheets inválido. Certifique-se de que a URL está correta.')
      }

      const spreadsheetId = match[0]
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
      
      const response = await fetch(exportUrl)
      if (!response.ok) {
        throw new Error('Não foi possível acessar a planilha. Verifique se ela está compartilhada como "Qualquer pessoa com o link pode ler".')
      }

      const csvData = await response.text()
      const workbook = XLSX.read(csvData, { type: 'string' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      if (json.length > 0) {
        const csvHeaders = json[0].map(h => String(h))
        setHeaders(csvHeaders)
        setPreviewData(json.slice(0, 21))
        setFullData(json)
        
        // Auto-mapping
        const initialMappings: Record<string, string> = {}
        SISTEA_FIELDS.forEach(field => {
          const match = csvHeaders.find(h => 
            h.toLowerCase().includes(field.label.toLowerCase()) || 
            h.toLowerCase().includes(field.key.replace('raw_', '').toLowerCase())
          )
          if (match) initialMappings[field.key] = match
        })
        setMappings(initialMappings)
        setFile(new File([], "Google Sheet Import"))
      }
      
    } catch (err: any) {
      console.error('Erro Google Sheets:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Nome do Paciente': 'JOÃO DA SILVA EXEMPLO',
        'CNS do Paciente': '123456789012345',
        'Nome do Profissional': 'DRA. MARIA OLIVEIRA EXEMPLO',
        'CNS/CPF Profissional': '987654321098765',
        'Código Procedimento': '0301010072',
        'Data do Atendimento': '10/05/2026',
        'Hora Início': '08:00',
        'Hora Fim': '09:00'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo de Importação')
    
    XLSX.writeFile(workbook, 'modelo_importacao_sistea.xlsx')
  }

  const handleStartMapping = () => {
    setStep('mapping')
  }

  const handleMappingChange = (fieldKey: string, excelHeader: string) => {
    setMappings(prev => ({ ...prev, [fieldKey]: excelHeader }))
  }

  const canProceedToMatching = () => {
    return SISTEA_FIELDS.filter(f => f.required).every(f => !!mappings[f.key])
  }

  const handleProcessImport = async () => {
    setLoading(true)
    setImportProgress(0)
    setError(null)

    try {
      const { data: batch, error: batchError } = await supabase
        .from('import_batches')
        .insert({
          file_name: file?.name || 'import_historico.xlsx',
          total_rows: fullData.length - 1,
          status: 'mapping',
          target_competence: selectedCompetence || null
        })
        .select()
        .single()

      if (batchError) throw batchError
      setCurrentBatchId(batch.id)

      const rowsToInsert = fullData.slice(1).map((row, idx) => {
        const record: any = {
          import_batch_id: batch.id,
          row_number: idx + 2,
          resolved_clinic_id: selectedClinicId
        }

        SISTEA_FIELDS.forEach(field => {
          const excelColName = mappings[field.key]
          if (excelColName) {
            const colIdx = headers.indexOf(excelColName)
            if (colIdx !== -1) {
              record[field.key] = row[colIdx]?.toString() || null
            }
          }
        })

        return record
      })

      const batchSize = 500
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const chunk = rowsToInsert.slice(i, i + batchSize)
        const { error: insertError } = await supabase
          .from('import_historical_records')
          .insert(chunk)

        if (insertError) throw insertError
        
        const progress = Math.min(100, Math.round(((i + chunk.length) / rowsToInsert.length) * 100))
        setImportProgress(progress)
      }

      await supabase
        .from('import_batches')
        .update({ status: 'matching' })
        .eq('id', batch.id)

      setStep('matching')
      setLoading(false)
    } catch (err: any) {
      console.error('Erro na importação:', err)
      setError(`Erro ao processar importação: ${err.message}`)
      setLoading(false)
    }
  }

  const handleFinalizeImport = async () => {
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase
        .rpc('finalize_historical_import', { p_batch_id: currentBatchId })

      if (rpcError) throw rpcError
      
      // Criar/Marcar a competência correspondente na tabela `competences` como histórica!
      if (selectedCompetence && selectedClinicId) {
        const [monthStr, yearStr] = selectedCompetence.split('/')
        const compMonth = parseInt(monthStr, 10)
        const compYear = parseInt(yearStr, 10)
        
        const { error: competenceError } = await supabase
          .from('competences')
          .upsert({
            clinic_id: selectedClinicId,
            month: compMonth,
            year: compYear,
            status: 'FECHADA',
            is_historical: true,
            closed_at: new Date().toISOString()
          }, {
            onConflict: 'clinic_id,month,year'
          })

        if (competenceError) {
          console.error('Erro ao marcar competência como histórica:', competenceError)
        }
      }

      setStep('completed')
    } catch (err: any) {
      setError(`Erro ao finalizar importação: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenQuickCreatePatient = () => {
    setQuickPatientData({
      name: editingRecord?.raw_patient_name || '',
      cns: editingRecord?.raw_patient_cns || '',
      birthDate: '',
      gender: 'N'
    })
    setQuickCreateType('patient')
  }

  const handleOpenQuickCreateProfessional = () => {
    setQuickProfessionalData({
      name: editingRecord?.raw_professional_name || '',
      cns: editingRecord?.raw_professional_cns || '',
      cbo: ''
    })
    setQuickCreateType('professional')
  }

  const handleSaveQuickPatient = async () => {
    if (!quickPatientData.name || !quickPatientData.cns || !quickPatientData.birthDate) {
      alert('Nome, CNS e Data de Nascimento são obrigatórios para o cadastro rápido.')
      return
    }

    setLoading(true)
    try {
      const { data, error: insertError } = await supabase
        .from('patients')
        .insert({
          name: quickPatientData.name.toUpperCase(),
          cns_patient: quickPatientData.cns,
          birth_date: quickPatientData.birthDate,
          gender: quickPatientData.gender,
          active: true,
          clinic_id: selectedClinicId || null
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 1. Atualizar opções locais
      setOptions(prev => ({
        ...prev,
        patients: [...prev.patients, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name))
      }))

      // 2. Selecionar automaticamente no modal de resolução
      setResolutionData(prev => ({ ...prev, patient_id: data.id }))

      // 3. Fechar submodal
      setQuickCreateType(null)
      alert('Paciente cadastrado e vinculado com sucesso!')
    } catch (err: any) {
      console.error('Erro no cadastro rápido de paciente:', err)
      alert(`Falha ao cadastrar paciente: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuickProfessional = async () => {
    if (!quickProfessionalData.name) {
      alert('O nome do profissional é obrigatório.')
      return
    }

    setLoading(true)
    try {
      const { data, error: insertError } = await supabase
        .from('professionals')
        .insert({
          name: quickProfessionalData.name.toUpperCase(),
          cns: quickProfessionalData.cns || null,
          cbo: quickProfessionalData.cbo || null,
          active: true
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Criar vínculo na tabela professional_clinics se clínica selecionada
      if (selectedClinicId) {
        await supabase.from('professional_clinics').insert({
          professional_id: data.id,
          clinic_id: selectedClinicId,
          active: true
        })
      }

      // 1. Atualizar opções locais
      setOptions(prev => ({
        ...prev,
        professionals: [...prev.professionals, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name))
      }))

      // 2. Selecionar automaticamente no modal de resolução
      setResolutionData(prev => ({ ...prev, professional_id: data.id }))

      // 3. Fechar submodal
      setQuickCreateType(null)
      alert('Profissional cadastrado e vinculado com sucesso!')
    } catch (err: any) {
      console.error('Erro no cadastro rápido de profissional:', err)
      alert(`Falha ao cadastrar profissional: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenArbitration = (record: any) => {
    setArbitrationRecord(record)
    setArbitrationJustification('')
    setIsArbitrationModalOpen(true)
  }

  const handleSaveArbitration = async () => {
    if (!arbitrationRecord) return
    if (!arbitrationJustification.trim()) {
      alert('Por favor, informe a justificativa para a aprovação.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('import_historical_records')
        .update({
          validation_status: 'approved',
          match_notes: `Aprovação de Arbitragem Auditada: ${arbitrationJustification}`
        })
        .eq('id', arbitrationRecord.id)

      if (updateError) throw updateError

      // 1. Atualizar estado local
      setUnresolvedRecords(prev => prev.filter(r => r.id !== arbitrationRecord.id))

      // 2. Recalcular estatísticas reais
      const { data: countData } = await supabase
        .from('import_historical_records')
        .select('validation_status')
        .eq('import_batch_id', currentBatchId)

      const validated = countData?.filter(r => r.validation_status === 'approved').length || 0
      const errors = countData?.filter(r => r.validation_status === 'glossed').length || 0
      setValidationStats({ validated, errors })

      setIsArbitrationModalOpen(false)
      setArbitrationRecord(null)
      alert('Arbitragem registrada com sucesso!')
    } catch (err: any) {
      console.error('Erro ao salvar arbitragem:', err)
      alert(`Erro ao registrar arbitragem: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmGlosaManual = async (record: any) => {
    if (!window.confirm('Deseja confirmar a glosa deste atendimento de forma permanente? Ele não será importado ao banco.')) return

    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('import_historical_records')
        .update({
          validation_status: 'glossed',
          match_notes: 'Glosado manualmente pelo auditor de forma permanente.'
        })
        .eq('id', record.id)

      if (updateError) throw updateError

      // 1. Atualizar estado local
      setUnresolvedRecords(prev => prev.filter(r => r.id !== record.id))

      // 2. Recalcular estatísticas reais
      const { data: countData } = await supabase
        .from('import_historical_records')
        .select('validation_status')
        .eq('import_batch_id', currentBatchId)

      const validated = countData?.filter(r => r.validation_status === 'approved').length || 0
      const errors = countData?.filter(r => r.validation_status === 'glossed').length || 0
      setValidationStats({ validated, errors })

      alert('Glosa manual registrada com sucesso!')
    } catch (err: any) {
      console.error('Erro ao registrar glosa manual:', err)
      alert(`Erro ao registrar glosa manual: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenResolution = (record: any) => {
    setEditingRecord(record)
    setResolutionData({
      patient_id: record.resolved_patient_id || '',
      professional_id: record.resolved_professional_id || '',
      procedure_id: record.resolved_procedure_id || '',
      cid: record.cid || '',
      service_classification_id: record.service_classification_id || '',
      attendance_character: record.attendance_character || '01',
      session_date: record.resolved_session_date || record.raw_session_date || '',
      start_time: record.resolved_start_time || record.raw_start_time || '',
      end_time: record.resolved_end_time || record.raw_end_time || '',
      auth_number: record.resolved_auth_number || record.raw_auth_number || '',
      quantity: record.resolved_quantity || 1
    })
    setIsResolutionModalOpen(true)
  }

  const saveResolution = async () => {
    if (!editingRecord) return
    setLoading(true)

    try {
      const isResolved = resolutionData.patient_id && 
                        resolutionData.professional_id && 
                        resolutionData.procedure_id

      const { error: updateError } = await supabase
        .from('import_historical_records')
        .update({
          resolved_patient_id: resolutionData.patient_id || null,
          resolved_professional_id: resolutionData.professional_id || null,
          resolved_procedure_id: resolutionData.procedure_id || null,
          cid: resolutionData.cid || null,
          service_classification_id: resolutionData.service_classification_id || null,
          attendance_character: resolutionData.attendance_character || '01',
          resolved_session_date: resolutionData.session_date || null,
          resolved_start_time: resolutionData.start_time || null,
          resolved_end_time: resolutionData.end_time || null,
          resolved_auth_number: resolutionData.auth_number || null,
          resolved_quantity: resolutionData.quantity || 1,
          match_status: isResolved ? 'resolved' : 'partial'
        })
        .eq('id', editingRecord.id)

      if (updateError) throw updateError

      setUnresolvedRecords(prev => prev.filter(r => r.id !== editingRecord.id))
      setIsResolutionModalOpen(false)
      
      if (step === 'matching') {
        runAutoMatching()
      } else if (step === 'validating') {
        runValidation()
      }

    } catch (err: any) {
      setError(`Erro ao salvar resolução: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <History className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Importação Histórica</h1>
            <p className="text-muted-foreground font-medium">Audite e importe dados legados com segurança e transparência.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border/50 p-4 rounded-3xl shadow-sm overflow-x-auto no-scrollbar">
        {[
          { id: 'upload', label: 'Upload', icon: FileUp },
          { id: 'mapping', label: 'Mapeamento', icon: TableIcon },
          { id: 'matching', label: 'Matching', icon: Database },
          { id: 'validating', label: 'Validação', icon: ShieldCheck },
          { id: 'completed', label: 'Concluído', icon: CheckCircle2 },
        ].map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all shrink-0 ${step === s.id ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
              <s.icon className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-widest">{s.label}</span>
            </div>
            {i < 4 && <div className="h-px w-8 bg-border shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {step === 'upload' && (
        <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="bg-card border border-border/50 rounded-[40px] p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Guia de Preparação da Planilha</h2>
                <p className="text-sm text-muted-foreground font-medium">Siga estas diretrizes para garantir uma importação sem erros.</p>
              </div>
              <button 
                onClick={handleDownloadTemplate}
                className="ml-auto flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-tighter transition-all shadow-sm"
              >
                <Download className="h-4 w-4" />
                Baixar Planilha Modelo
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Colunas Obrigatórias
                </h3>
                <ul className="space-y-2">
                  {[
                    { label: 'Paciente', desc: 'Nome completo e CNS' },
                    { label: 'Profissional', desc: 'Nome completo e CNS/CPF' },
                    { label: 'Procedimento', desc: 'Código oficial' }
                  ].map((item, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Formatos de Data/Hora
                </h3>
                <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Datas:</span>
                    <code className="text-[10px] bg-background px-2 py-1 rounded border border-border">DD/MM/AAAA</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Horários:</span>
                    <code className="text-[10px] bg-background px-2 py-1 rounded border border-border">HH:MM</code>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Dicas de Sucesso
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </div>
                    <p className="text-[11px] text-foreground/70 font-medium"><b>Identificadores Únicos:</b> Sempre que possível, inclua o CNS ou CPF.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Seleção de Clínica Obrigatória */}
              <div className="bg-card border border-border/50 rounded-[40px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Clínica de Destino</h3>
                    <p className="text-[11px] text-muted-foreground font-medium">Todos os registros deste lote serão vinculados a esta clínica.</p>
                  </div>
                </div>

                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                >
                  <option value="">Selecione uma clínica...</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {!selectedClinicId && (
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                    <AlertTriangle className="h-3 w-3" />
                    Seleção obrigatória para habilitar o upload
                  </div>
                )}

                {selectedClinicId && (
                  <div className="pt-6 mt-6 border-t border-border/30 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Competência de Faturamento</h3>
                        <p className="text-[11px] text-muted-foreground font-medium">Digite a competência retroativa no formato MM/AAAA (ex: 05/2024).</p>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="MM/AAAA (ex: 05/2024)"
                      maxLength={7}
                      value={selectedCompetence}
                      onChange={(e) => handleCompetenceChange(e.target.value)}
                      className={`w-full bg-muted/50 border ${!isCompetenceValid ? 'border-destructive focus:ring-destructive/10' : 'border-border/50 focus:ring-primary/10'} rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 transition-all outline-none`}
                    />

                    {!isCompetenceValid && (
                      <div className="mt-2 text-[10px] text-destructive font-bold uppercase tracking-wider">
                        Formato inválido! Insira um mês válido (01 a 12) e um ano com 4 dígitos.
                      </div>
                    )}

                    {isCompetenceValid && selectedCompetence === '' && (
                      <div className="mt-2 text-[10px] text-muted-foreground font-semibold">
                        Aviso: Em branco, o faturamento usará a data de atendimento de cada registro (Automático).
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex bg-muted/50 p-1 rounded-2xl mb-4 border border-border/50">
                <button 
                  onClick={() => setImportSource('file')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${importSource === 'file' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Upload de Arquivo
                </button>
                <button 
                  onClick={() => setImportSource('google')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${importSource === 'google' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Google Sheets Link
                </button>
              </div>

              {importSource === 'file' ? (
                <div 
                  className={`
                    border-4 border-dashed rounded-[40px] p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-6
                    ${!selectedClinicId || !isCompetenceValid ? 'opacity-30 cursor-not-allowed grayscale' : ''}
                    ${file ? 'border-primary/50 bg-primary/5' : 'border-muted hover:border-primary/30 hover:bg-muted/30'}
                  `}
                  onClick={() => selectedClinicId && isCompetenceValid && document.getElementById('excel-upload')?.click()}
                >
                  <input 
                    id="excel-upload"
                    type="file" 
                    className="hidden" 
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                  />
                  
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                    {loading ? (
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    ) : (
                      <FileUp className="h-10 w-10 text-primary" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {file ? file.name : 'Selecione sua planilha'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                      Arraste ou clique para selecionar arquivos .xlsx ou .xls
                    </p>
                  </div>

                  {file && !loading && (
                    <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-black uppercase">
                      <CheckCircle2 className="h-4 w-4" />
                      Arquivo pronto para processar
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card border border-border/50 rounded-[40px] p-10 space-y-6 shadow-sm">
                  <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <Database className="h-10 w-10 text-emerald-500" />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-foreground">Conectar Google Sheets</h3>
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                      Insira o link da sua planilha compartilhada.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <input 
                      type="text"
                      value={googleUrl}
                      onChange={(e) => setGoogleUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                    />
                    
                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-600 font-medium leading-normal">
                        Certifique-se de que a planilha está configurada como <b>"Qualquer pessoa com o link pode ler"</b>.
                      </p>
                    </div>

                    <button 
                      onClick={handleGoogleSheetsImport}
                      disabled={!googleUrl || loading || !selectedClinicId || !isCompetenceValid}
                      className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 hover:-translate-y-1 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Buscando Dados...' : 'Conectar e Visualizar'}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <button 
                disabled={!file || loading}
                onClick={handleStartMapping}
                className={`
                  w-full font-black py-5 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-3
                  ${file && !loading ? 'bg-primary text-primary-foreground shadow-primary/20 hover:-translate-y-1 hover:shadow-2xl active:scale-95' : 'bg-muted text-muted-foreground cursor-not-allowed'}
                `}
              >
                Iniciar Auditoria de Dados
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>

          <div className="bg-card border border-border/50 rounded-[40px] p-8 shadow-sm overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-primary" />
              Pré-visualização dos Dados
            </h2>
            
            <div className="flex-1 overflow-auto rounded-2xl border border-border/30 bg-muted/20 custom-scrollbar">
              {previewData.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border/50 z-10">
                    <tr>
                      {previewData[0].map((h: any, i: number) => (
                        <th key={i} className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {h || `Coluna ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {previewData.slice(1).map((row, i) => (
                      <tr key={i} className="hover:bg-primary/5 transition-colors">
                        {row.map((cell: any, j: number) => (
                          <td key={j} className="px-4 py-3 font-medium text-foreground/70 whitespace-nowrap">
                            {cell?.toString() || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                  <TableIcon className="h-12 w-12 opacity-10 mb-4" />
                  <p className="text-sm font-medium">Nenhum dado carregado ainda.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Fase 2: Mapeamento de Colunas */}
      {step === 'mapping' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="bg-card border border-border/50 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Mapeamento de Colunas
            </h2>
            <p className="text-sm text-muted-foreground mb-8 font-medium">
              Associe os campos do sistema às colunas da sua planilha Excel.
            </p>

            <div className="space-y-6">
              {SISTEA_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground flex items-center justify-between">
                    <span>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                    {mappings[field.key] && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full lowercase font-bold">
                        mapeado
                      </span>
                    )}
                  </label>
                  <select
                    value={mappings[field.key] || ''}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    className={`
                      w-full bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium transition-all
                      ${mappings[field.key] ? 'border-primary/50 text-foreground ring-2 ring-primary/5' : 'text-muted-foreground'}
                    `}
                  >
                    <option value="">Selecione uma coluna...</option>
                    {headers.map((h, i) => (
                      <option key={i} value={h}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col gap-4">
              {loading && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-primary">
                    <span>Processando registros...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="h-3 w-full bg-primary/10 rounded-full overflow-hidden border border-primary/20">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep('upload')}
                  disabled={loading}
                  className="flex-1 bg-muted text-foreground font-black py-4 rounded-2xl hover:bg-muted/70 transition-all disabled:opacity-50"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleProcessImport}
                  disabled={!canProceedToMatching() || loading}
                  className={`
                    flex-[2] font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2
                    ${canProceedToMatching() && !loading ? 'bg-primary text-primary-foreground shadow-primary/20 hover:-translate-y-1' : 'bg-muted text-muted-foreground cursor-not-allowed'}
                  `}
                >
                  {loading ? 'Processando...' : 'Processar e Iniciar Matching'}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8">
              <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Por que o mapeamento é importante?
              </h3>
              <p className="text-sm text-primary/80 font-medium leading-relaxed">
                O SisTEA utiliza algoritmos de inteligência e busca fuzzy para cruzar os dados da sua planilha com a nossa base de dados oficial. 
                <br /><br />
                Mapear corretamente as colunas garante que:
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  { title: 'Matching de Pacientes', desc: 'Identifica o paciente mesmo se o nome estiver escrito diferente.' },
                  { title: 'Conferência de CNS', desc: 'Valida se o profissional está apto a realizar o procedimento.' },
                  { title: 'Auditoria BR-010', desc: 'Detecta profissionais atendendo em múltiplos locais simultaneamente.' }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-primary uppercase tracking-tight">{item.title}</h4>
                      <p className="text-xs text-primary/60 font-medium">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-border/50 rounded-3xl p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aviso de Privacidade</p>
                <p className="text-[11px] font-medium text-foreground/70 leading-tight mt-1">
                  Os dados importados são temporários e só serão gravados definitivamente após sua aprovação final.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fase 2.2: Matching */}
      {step === 'matching' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-card border border-border/50 rounded-3xl p-8 shadow-sm">
                <div className="mb-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Clínica Selecionada</p>
                    <div className="flex items-center gap-2 text-primary">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm font-bold">{clinics.find(c => c.id === selectedClinicId)?.name || 'Clínica não identificada'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Competência de Destino</p>
                    <div className="flex items-center gap-2 text-primary">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-bold">
                        {selectedCompetence ? `${selectedCompetence}` : 'Data do Atendimento (Automático)'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Status do Matching
                </h2>

                <div className="space-y-6">
                  {[
                    { key: 'patients', label: 'Pacientes', icon: Users },
                    { key: 'professionals', label: 'Profissionais', icon: UserSquare2 },
                    { key: 'clinics', label: 'Clínicas', icon: Building2 },
                    { key: 'procedures', label: 'Procedimentos', icon: Stethoscope },
                  ].map((item, i) => {
                    const stats = matchingStats[item.key as keyof typeof matchingStats]
                    const percent = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0
                    
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-3.5 w-3.5 text-primary" />
                            {item.label}
                          </div>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-1000 ease-in-out" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold flex justify-between">
                          <span>{stats.matched} encontrados</span>
                          <span>{stats.total - stats.matched} pendentes</span>
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-12 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-xs font-medium text-primary/70 leading-relaxed">
                    Registros com 100% de matching estarão prontos para a fase de validação de regras de negócio.
                  </p>
                </div>
              </div>

              <button
                onClick={runValidation}
                disabled={loading || unresolvedRecords.length > 0}
                className={`
                  w-full font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2
                  ${!loading && unresolvedRecords.length === 0 ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:-translate-y-1' : 'bg-muted text-muted-foreground cursor-not-allowed'}
                `}
              >
                Prosseguir para Validação
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-xl h-full flex flex-col">
                <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Registros Pendentes de Resolução
                  </h2>
                  <span className="text-xs font-black bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-full uppercase tracking-tighter">
                    {unresolvedRecords.length} pendentes
                  </span>
                </div>
                
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground h-full">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse">
                        <Search className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="text-sm font-bold">Iniciando processamento automático...</p>
                      <p className="text-xs mt-1">Isso pode levar alguns segundos dependendo do tamanho da planilha.</p>
                    </div>
                  ) : unresolvedRecords.length > 0 ? (
                    <div className="divide-y divide-border/30">
                      {unresolvedRecords.map((record, i) => (
                        <div key={i} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-muted px-2 py-0.5 rounded uppercase">Linha {record.row_number}</span>
                              <h4 className="text-sm font-bold truncate">{record.raw_patient_name}</h4>
                            </div>
                            <div className="flex gap-4 text-[11px] text-muted-foreground font-medium">
                              <span className="flex items-center gap-1"><UserSquare2 className="h-3 w-3" /> {record.raw_professional_name}</span>
                              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {record.raw_clinic_name}</span>
                            </div>
                          </div>
                          <button 
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0"
                            onClick={() => handleOpenResolution(record)}
                          >
                            Resolver
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground h-full">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-bold text-foreground">Todos os registros resolvidos!</p>
                      <p className="text-xs mt-1">Você pode prosseguir para a próxima etapa.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fase 3: Validação */}
      {step === 'validating' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Válidos</p>
                <p className="text-2xl font-black">{validationStats.validated}</p>
              </div>
            </div>
            
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Com Erros</p>
                <p className="text-2xl font-black">{validationStats.errors}</p>
              </div>
            </div>

            <div className="lg:col-span-2 bg-primary text-primary-foreground rounded-3xl p-6 shadow-lg shadow-primary/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status Final</p>
                <p className="text-xl font-bold">
                  {validationStats.errors === 0 
                    ? 'Tudo pronto para importar!' 
                    : `${validationStats.errors} registros precisam de correção`}
                </p>
              </div>
              <button
                onClick={handleFinalizeImport}
                disabled={loading || validationStats.validated === 0}
                className="bg-white text-primary px-6 py-3 rounded-xl font-black text-sm hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? 'Finalizando...' : 'Finalizar Importação'}
              </button>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Relatório de Inconsistências
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-background border border-border/50 px-4 py-2 rounded-xl">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-muted-foreground">{clinics.find(c => c.id === selectedClinicId)?.name}</span>
                </div>
                <div className="flex items-center gap-2 bg-background border border-border/50 px-4 py-2 rounded-xl">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-muted-foreground">
                    {selectedCompetence ? `${selectedCompetence}` : 'Auto (Data Atend.)'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-border/30 overflow-auto max-h-[600px] custom-scrollbar">
              {loading ? (
                <div className="p-12 text-center animate-pulse">
                  <p className="text-sm font-bold text-muted-foreground">Validando regras de negócio...</p>
                </div>
              ) : unresolvedRecords.length > 0 ? (
                unresolvedRecords.map((record, i) => {
                  // Verificar se é Glosa Automática de Ofício (Regras inativas ou conflito interno profissional)
                  const hasAutoGloss = record.validation_rules_violated?.some((r: string) => 
                    ['BR-001', 'BR-002', 'BR-003', 'BR-010-INT'].includes(r)
                  );
                  
                  return (
                    <div key={i} className="p-6 hover:bg-muted/10 transition-colors border-b border-border/20">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black bg-muted px-2 py-0.5 rounded uppercase">Linha {record.row_number}</span>
                            <h4 className="text-sm font-bold text-foreground truncate">{record.raw_patient_name}</h4>
                            
                            {hasAutoGloss ? (
                              <span className="inline-flex items-center rounded-lg bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-600 border border-red-500/20 uppercase tracking-widest leading-none">
                                Glosa Automática de Ofício
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-600 border border-amber-500/20 uppercase tracking-widest leading-none">
                                Arbitragem Pendente
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {record.validation_details?.map((err: any, j: number) => (
                              <div key={j} className="flex items-center gap-1.5 bg-red-500/5 text-red-600 dark:text-red-400 border border-red-500/10 px-3 py-1.5 rounded-lg text-xs">
                                <span className="text-[10px] font-black bg-red-500/10 px-1 rounded">{err.code}</span>
                                <span className="font-medium">{err.message}</span>
                              </div>
                            ))}
                          </div>
                          
                          {record.match_notes && (
                            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 italic bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10 mt-2">
                              {record.match_notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          <button 
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all"
                            onClick={() => handleOpenResolution(record)}
                          >
                            Corrigir Vínculos
                          </button>
                          
                          {!hasAutoGloss && (
                            <>
                              <button 
                                className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all border border-emerald-500/20"
                                onClick={() => handleOpenArbitration(record)}
                              >
                                Aprovar com Justificativa
                              </button>
                              <button 
                                className="bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all border border-red-500/20"
                                onClick={() => handleConfirmGlosaManual(record)}
                              >
                                Confirmar Glosa
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-500">
                    <ShieldCheck className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-bold">Nenhuma inconsistência encontrada</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Todos os registros foram validados com sucesso contra as regras BR-001 a BR-010. Você pode prosseguir com a gravação definitiva.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fase 4: Concluído */}
      {step === 'completed' && (
        <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-700">
          <div className="h-24 w-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-8">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-3xl font-black mb-4">Importação Concluída!</h2>
          <p className="text-muted-foreground font-medium text-center max-w-lg">
            Os registros históricos foram auditados, validados e inseridos com sucesso na base de dados do SisTEA.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-12 bg-primary text-primary-foreground font-black px-8 py-4 rounded-2xl shadow-lg hover:-translate-y-1 transition-all"
          >
            Iniciar Nova Importação
          </button>
        </div>
      )}
      {/* Modal de Resolução */}
      {isResolutionModalOpen && editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsResolutionModalOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-[2.5rem] overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Resolução Manual Auditada
                </h3>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">Fase de Auditoria</span>
                  <span>•</span>
                  <span>Linha {editingRecord.row_number} da Planilha</span>
                </p>
              </div>
              <button 
                onClick={() => setIsResolutionModalOpen(false)}
                className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-8">
              {/* Info da Planilha */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-6 rounded-3xl border border-border/50">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Paciente (Planilha)</p>
                  <p className="text-sm font-bold truncate">{editingRecord.raw_patient_name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">CNS: {editingRecord.raw_patient_cns || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Profissional (Planilha)</p>
                  <p className="text-sm font-bold truncate">{editingRecord.raw_professional_name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">CNS/CPF: {editingRecord.raw_professional_cns || 'N/A'}</p>
                </div>
              </div>

              {/* Classificação Clínica (Nova Sessão Destacada) */}
              <div className="bg-primary/5 border-y border-primary/10 -mx-8 px-8 py-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      CID Principal
                    </label>
                    <SearchableSelect 
                      options={options.cids}
                      value={resolutionData.cid}
                      onChange={(val) => setResolutionData(prev => ({ ...prev, cid: val }))}
                      placeholder="Busque o CID..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Classificação DataSUS
                    </label>
                    <SearchableSelect 
                      options={options.service_classifications}
                      value={resolutionData.service_classification_id}
                      onChange={(val) => setResolutionData(prev => ({ ...prev, service_classification_id: val }))}
                      placeholder="Selecione a classificação..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Caráter de Atendimento
                  </label>
                  <select
                    value={resolutionData.attendance_character}
                    onChange={(e) => setResolutionData(prev => ({ ...prev, attendance_character: e.target.value }))}
                    className="w-full bg-background border border-border/60 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  >
                    <option value="01">01 - Eletivo</option>
                    <option value="02">02 - Urgência</option>
                    <option value="03">03 - Acidente no local de trabalho</option>
                    <option value="04">04 - Acidente no trajeto do trabalho</option>
                    <option value="05">05 - Outros tipos de acidente de trânsito</option>
                    <option value="06">06 - Outros tipos de lesões/envenenamentos</option>
                  </select>
                </div>
              </div>

              {/* Formulário de Vínculo */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-foreground">Vincular Paciente Oficial</label>
                      <button
                        type="button"
                        onClick={handleOpenQuickCreatePatient}
                        className="text-[9px] font-black text-purple-600 hover:text-purple-700 hover:underline uppercase tracking-wider flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Cadastrar Rápido
                      </button>
                    </div>
                    <SearchableSelect 
                      options={options.patients}
                      value={resolutionData.patient_id}
                      onChange={(val) => setResolutionData(prev => ({ ...prev, patient_id: val }))}
                      placeholder="Selecione o paciente no sistema..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-foreground">Vincular Profissional Oficial</label>
                      <button
                        type="button"
                        onClick={handleOpenQuickCreateProfessional}
                        className="text-[9px] font-black text-purple-600 hover:text-purple-700 hover:underline uppercase tracking-wider flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Cadastrar Rápido
                      </button>
                    </div>
                    <SearchableSelect 
                      options={options.professionals}
                      value={resolutionData.professional_id}
                      onChange={(val) => setResolutionData(prev => ({ ...prev, professional_id: val }))}
                      placeholder="Selecione o profissional no sistema..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-foreground">Procedimento Oficial</label>
                  <SearchableSelect 
                    options={options.procedures}
                    value={resolutionData.procedure_id}
                    onChange={(val) => setResolutionData(prev => ({ ...prev, procedure_id: val }))}
                    placeholder="Selecione o procedimento..."
                  />
                </div>

                <div className="pt-8 border-t border-border/40 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      <FileUp className="h-3.5 w-3.5 text-primary" />
                      Metadados de Produção (BPA)
                    </h4>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10 text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">
                      <ShieldCheck className="h-3 w-3" />
                      Integridade Forense Ativa
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-muted-foreground">Data da Guia</label>
                      <input 
                        type="date"
                        value={resolutionData.session_date}
                        onChange={(e) => setResolutionData(prev => ({ ...prev, session_date: e.target.value }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-muted-foreground">Entrada</label>
                      <input 
                        type="time"
                        value={resolutionData.start_time}
                        onChange={(e) => setResolutionData(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-muted-foreground">Saída</label>
                      <input 
                        type="time"
                        value={resolutionData.end_time}
                        onChange={(e) => setResolutionData(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-[9px] font-black uppercase text-muted-foreground">Nº de Autorização</label>
                      <input 
                        type="text"
                        value={resolutionData.auth_number}
                        onChange={(e) => setResolutionData(prev => ({ ...prev, auth_number: e.target.value }))}
                        placeholder="Ex: 123456"
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-muted-foreground">Qtd. BPA</label>
                      <input 
                        type="number"
                        value={resolutionData.quantity}
                        onChange={(e) => setResolutionData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-border/50 bg-muted/20 flex gap-4">
              <button 
                onClick={() => setIsResolutionModalOpen(false)}
                className="flex-1 bg-card border border-border font-black py-4 rounded-2xl hover:bg-muted transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={saveResolution}
                disabled={loading}
                className="flex-[2] bg-primary text-primary-foreground font-black py-4 rounded-2xl shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Resolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submodal de Cadastro Rápido Ex-Officio */}
      {quickCreateType && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-purple-500/20 rounded-[2rem] shadow-2xl p-6 relative animate-in zoom-in duration-200">
            <h4 className="text-base font-black text-purple-600 dark:text-purple-400 mb-6 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {quickCreateType === 'patient' 
                ? 'Cadastro Rápido de Paciente (Ex-Officio)' 
                : 'Cadastro Rápido de Profissional (Ex-Officio)'}
            </h4>

            {quickCreateType === 'patient' ? (
              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</label>
                  <input
                    type="text"
                    value={quickPatientData.name}
                    onChange={(e) => setQuickPatientData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CNS do Paciente</label>
                  <input
                    type="text"
                    value={quickPatientData.cns}
                    onChange={(e) => setQuickPatientData(prev => ({ ...prev, cns: e.target.value }))}
                    maxLength={15}
                    placeholder="15 dígitos"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Nascimento</label>
                    <input
                      type="date"
                      value={quickPatientData.birthDate}
                      onChange={(e) => setQuickPatientData(prev => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gênero</label>
                    <select
                      value={quickPatientData.gender}
                      onChange={(e) => setQuickPatientData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                    >
                      <option value="M">Masc (M)</option>
                      <option value="F">Fem (F)</option>
                      <option value="I">Indefinido (I)</option>
                      <option value="N">Não Informado (N)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome do Profissional</label>
                  <input
                    type="text"
                    value={quickProfessionalData.name}
                    onChange={(e) => setQuickProfessionalData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CNS ou CPF</label>
                  <input
                    type="text"
                    value={quickProfessionalData.cns}
                    onChange={(e) => setQuickProfessionalData(prev => ({ ...prev, cns: e.target.value }))}
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CBO (Especialidade)</label>
                  <input
                    type="text"
                    value={quickProfessionalData.cbo}
                    onChange={(e) => setQuickProfessionalData(prev => ({ ...prev, cbo: e.target.value }))}
                    placeholder="Ex: 225112"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => setQuickCreateType(null)}
                className="flex-1 bg-muted text-foreground font-black py-3 rounded-xl text-xs hover:bg-muted/70 transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={quickCreateType === 'patient' ? handleSaveQuickPatient : handleSaveQuickProfessional}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
              >
                Salvar e Vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Arbitragem */}
      {isArbitrationModalOpen && arbitrationRecord && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-emerald-500/20 rounded-[2rem] shadow-2xl p-6 relative animate-in zoom-in duration-200">
            <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Arbitragem de Validação
            </h4>
            <p className="text-xs text-muted-foreground mb-6 font-medium leading-relaxed">
              Você está aprovando manualmente o atendimento da linha <strong>{arbitrationRecord.row_number}</strong> para o paciente <strong>{arbitrationRecord.raw_patient_name}</strong>.
              <br /><br />
              Esta ação será auditada e gravada permanentemente. Por favor, forneça uma justificativa técnica clara para esta aprovação ex-officio:
            </p>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Justificativa Técnica</label>
              <textarea
                value={arbitrationJustification}
                onChange={(e) => setArbitrationJustification(e.target.value)}
                placeholder="Ex: Paciente realizou terapias sequenciais legítimas em salas diferentes..."
                rows={4}
                className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
              />
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsArbitrationModalOpen(false)
                  setArbitrationRecord(null)
                }}
                className="flex-1 bg-muted text-foreground font-black py-3 rounded-xl text-xs hover:bg-muted/70 transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveArbitration}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                Aprovar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
