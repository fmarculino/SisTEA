'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { userSchema, UserFormData } from './schema'
import { logAudit } from '@/lib/audit'
import { getUserProfile } from '@/lib/dal'

// Helper to create an admin client (direct client, no cookie handling needed for admin operations)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Configuração de servidor ausente: Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel.')
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function createUser(data: UserFormData) {
  try {
    const profile = await getUserProfile()
    if (!profile || !['SMS_ADMIN', 'GERENTE'].includes(profile.role)) {
      return { error: 'Não autorizado' }
    }

    const validatedFields = userSchema.safeParse(data)

    if (!validatedFields.success) {
      return { error: 'Dados inválidos' }
    }

    let { name, email, password, role, clinic_id } = validatedFields.data

    if (!password) {
      return { error: 'Senha é obrigatória para novos usuários' }
    }

    // Security check for GERENTE
    if (profile.role === 'GERENTE') {
      if (!['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(role)) {
        return { error: 'Não autorizado a criar usuários com este papel' }
      }
      clinic_id = profile.clinic_id
    }

    const supabase = createAdminClient()

    // 1. Create user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (authError) {
      console.error('Auth Error:', authError)
      return { error: `Erro ao criar usuário no Auth: ${authError.message}` }
    }

    // 2. Create user record in public.users
    const isClinicRole = ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(role)
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        name,
        email,
        role,
        clinic_id: isClinicRole ? clinic_id : null,
      })

    if (profileError) {
      console.error('Profile Error:', profileError)
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return { error: `Erro ao criar perfil: ${profileError.message}` }
    }

    // 3. Create user_clinics record (multi-unidade)
    if (isClinicRole && clinic_id) {
      const { error: ucError } = await supabase
        .from('user_clinics')
        .insert({
          user_id: authUser.user.id,
          clinic_id: clinic_id,
          is_default: true,
        })
      if (ucError) {
        console.error('UserClinics Error:', ucError)
      }
    }

    revalidatePath('/dashboard/users')

    // Log audit
    await logAudit({
      action: 'CREATE',
      table_name: 'users',
      record_id: authUser.user.id,
      new_data: { name, email, role, clinic_id },
      description: `Criou novo usuário: ${name} <${email}> (${role}).`
    })

    return { success: true }
  } catch (error: any) {
    console.error('Create User Error:', error)
    return { error: error.message || 'Erro inesperado ao criar usuário' }
  }
}

export async function updateUser(id: string, data: Partial<UserFormData>) {
  try {
    const profile = await getUserProfile()
    if (!profile || !['SMS_ADMIN', 'GERENTE'].includes(profile.role)) {
      return { error: 'Não autorizado' }
    }

    const supabase = createAdminClient()

    // Security check for GERENTE
    if (profile.role === 'GERENTE') {
      // Verificar via user_clinics se o usuário pertence à mesma clínica
      const { data: userClinics } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', id)

      const userClinicIds = (userClinics || []).map((uc: any) => uc.clinic_id)
      const hasAccess = userClinicIds.includes(profile.clinic_id)

      // Fallback: verificar campo legado
      if (!hasAccess) {
        const { data: userToEdit } = await supabase
          .from('users')
          .select('clinic_id')
          .eq('id', id)
          .single()

        if (!userToEdit || userToEdit.clinic_id !== profile.clinic_id) {
          return { error: 'Não autorizado a alterar usuários de outra clínica' }
        }
      }

      if (data.role && !['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(data.role)) {
        return { error: 'Não autorizado a definir este papel' }
      }

      data.clinic_id = profile.clinic_id
    }

    // 1. Update Auth email/password if provided
    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.password) updateData.password = data.password
    if (data.name) updateData.user_metadata = { name: data.name }

    if (Object.keys(updateData).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, updateData)
      if (authError) {
        return { error: `Erro ao atualizar Auth: ${authError.message}` }
      }
    }

    // 2. Update public profile
    const isClinicRole = data.role && ['GERENTE', 'RECEPCIONISTA', 'FATURISTA'].includes(data.role)
    const { error: profileError } = await supabase
      .from('users')
      .update({
        name: data.name,
        email: data.email,
        role: data.role,
        clinic_id: isClinicRole ? data.clinic_id : null,
      })
      .eq('id', id)

    if (profileError) {
      return { error: `Erro ao atualizar perfil: ${profileError.message}` }
    }

    // 3. Sync user_clinics
    if (isClinicRole && data.clinic_id) {
      // Upsert: garante que o vínculo existe na user_clinics
      await supabase
        .from('user_clinics')
        .upsert({
          user_id: id,
          clinic_id: data.clinic_id,
          is_default: true,
        }, {
          onConflict: 'user_id,clinic_id'
        })
    }

    revalidatePath('/dashboard/users')

    // Log audit
    await logAudit({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      new_data: { name: data.name, email: data.email, role: data.role, clinic_id: data.clinic_id },
      description: `Atualizou dados do usuário: ${data.name || data.email || id}.`
    })

    return { success: true }
  } catch (error: any) {
    console.error('Update User Error:', error)
    return { error: error.message || 'Erro inesperado ao atualizar usuário' }
  }
}

export async function toggleUserStatus(id: string, currentStatus: boolean) {
  try {
    const profile = await getUserProfile()
    if (!profile || !['SMS_ADMIN', 'GERENTE'].includes(profile.role)) {
      return { error: 'Não autorizado' }
    }

    const supabase = createAdminClient()

    // Security check for GERENTE
    if (profile.role === 'GERENTE') {
      const { data: userToEdit } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', id)
        .single()

      if (!userToEdit || userToEdit.clinic_id !== profile.clinic_id) {
        return { error: 'Não autorizado a alterar status de usuários de outra clínica' }
      }
    }

    const { error } = await supabase
      .from('users')
      .update({ active: !currentStatus })
      .eq('id', id)

    if (error) {
      return { error: `Erro ao alterar status: ${error.message}` }
    }

    revalidatePath('/dashboard/users')

    // Log audit
    await logAudit({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      description: `${!currentStatus ? 'Ativou' : 'Desativou'} o acesso do usuário ID: ${id}.`
    })

    return { success: true }
  } catch (error: any) {
    console.error('Toggle Status Error:', error)
    return { error: error.message || 'Erro inesperado ao alterar status' }
  }
}
