'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { userSchema, UserFormData } from './schema'

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
    const validatedFields = userSchema.safeParse(data)

    if (!validatedFields.success) {
      return { error: 'Dados inválidos' }
    }

    const { email, password, role, clinic_id } = validatedFields.data

    if (!password) {
      return { error: 'Senha é obrigatória para novos usuários' }
    }

    const supabase = createAdminClient()

    // 1. Create user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth Error:', authError)
      return { error: `Erro ao criar usuário no Auth: ${authError.message}` }
    }

    // 2. Create user record in public.users
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        role,
        clinic_id: role === 'CLINIC_USER' ? clinic_id : null,
      })

    if (profileError) {
      console.error('Profile Error:', profileError)
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return { error: `Erro ao criar perfil: ${profileError.message}` }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Create User Error:', error)
    return { error: error.message || 'Erro inesperado ao criar usuário' }
  }
}

export async function updateUser(id: string, data: Partial<UserFormData>) {
  try {
    const supabase = createAdminClient()

    // 1. Update Auth email/password if provided
    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.password) updateData.password = data.password

    if (Object.keys(updateData).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, updateData)
      if (authError) {
        return { error: `Erro ao atualizar Auth: ${authError.message}` }
      }
    }

    // 2. Update public profile
    const { error: profileError } = await supabase
      .from('users')
      .update({
        email: data.email, // Keep in sync
        role: data.role,
        clinic_id: data.role === 'CLINIC_USER' ? data.clinic_id : null,
      })
      .eq('id', id)

    if (profileError) {
      return { error: `Erro ao atualizar perfil: ${profileError.message}` }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Update User Error:', error)
    return { error: error.message || 'Erro inesperado ao atualizar usuário' }
  }
}

/*
export async function deleteUser(id: string) {
  try {
    const supabase = createAdminClient()

    // 1. Delete from Auth (this usually triggers deletion in public if configured, but let's be explicit)
    const { error: authError } = await supabase.auth.admin.deleteUser(id)

    if (authError) {
      return { error: authError.message }
    }

    // Row in public.users should be deleted via cascade or manual if not
    // supabase.from('users').delete().eq('id', id)

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Delete User Error:', error)
    return { error: error.message || 'Erro inesperado ao excluir usuário' }
  }
}
*/

export async function toggleUserStatus(id: string, currentStatus: boolean) {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({ active: !currentStatus })
      .eq('id', id)

    if (error) {
      return { error: `Erro ao alterar status: ${error.message}` }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Toggle Status Error:', error)
    return { error: error.message || 'Erro inesperado ao alterar status' }
  }
}
