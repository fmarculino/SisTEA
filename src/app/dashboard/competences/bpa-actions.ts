'use server'

import { getUserProfile } from '@/lib/dal'
import { BpaExportService } from '@/lib/bpa/BpaExportService'

// Helper: verifica se o usuário tem acesso a uma clínica (direta ou via grupo)
function userCanAccessClinic(profile: any, clinic_id: string): boolean {
  if (profile.role === 'SMS_ADMIN') return true
  // Verifica acesso direto ou via linked_clinics
  if (profile.clinic_id === clinic_id) return true
  return (profile.linked_clinics || []).some((lc: any) => lc.clinic_id === clinic_id)
}

export async function validateBpaExportAction(clinic_id: string, month_year: string) {
  const profile = await getUserProfile()

  if (!profile || !userCanAccessClinic(profile, clinic_id)) {
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

  if (!profile || !userCanAccessClinic(profile, clinic_id)) {
    return { error: 'Sem permissão para exportar BPA desta clínica.' }
  }

  try {
    const txtContent = await BpaExportService.generateTxt(clinic_id, month_year)
    const filename = await BpaExportService.getSuggestedFilename(clinic_id, month_year)
    return { success: true, txtContent, filename }
  } catch (err: any) {
    return { error: err.message || 'Erro inesperado na geração.' }
  }
}

