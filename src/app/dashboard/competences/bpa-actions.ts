'use server'

import { getUserProfile } from '@/lib/dal'
import { BpaExportService } from '@/lib/bpa/BpaExportService'

export async function validateBpaExportAction(clinic_id: string, month_year: string) {
  const profile = await getUserProfile()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.clinic_id !== clinic_id)) {
    return { error: 'Sem permissão para exportar BPA desta clínica.' }
  }

  try {
    const result = await BpaExportService.validateExport(clinic_id, month_year)
    return { success: true, data: result }
  } catch (err: any) {
    return { error: err.message || 'Erro inesperado na validação.' }
  }
}

export async function generateBpaTxtAction(clinic_id: string, month_year: string) {
  const profile = await getUserProfile()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.clinic_id !== clinic_id)) {
    return { error: 'Sem permissão para exportar BPA desta clínica.' }
  }

  try {
    const txtContent = await BpaExportService.generateTxt(clinic_id, month_year)
    return { success: true, txtContent }
  } catch (err: any) {
    return { error: err.message || 'Erro inesperado na geração.' }
  }
}
