import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware: Missing Supabase environment variables')
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const publicRoutes = ['/login', '/forgot-password', '/validar', '/manifest.json', '/sw.js']
    const authRoutes = ['/auth/callback', '/auth/update-password']
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))

    // --- CHECK ACTIVE STATUS (with 5-min cache) ---
    const statusCache = request.cookies.get('user-status-verified')
    
    if (user && !statusCache) {
      const { data: profile } = await supabase
        .from('users')
        .select('active, role, clinic:clinics(active)')
        .eq('id', user.id)
        .single()

      if (profile) {
        let blockMessage = ''
        if (profile.active === false) {
          blockMessage = 'Seu usuário está desativado. Entre em contato com o suporte.'
        } else if (profile.role !== 'SMS_ADMIN' && profile.clinic && !(profile.clinic as any).active) {
          blockMessage = 'Esta clínica está desativada. O acesso foi bloqueado.'
        }

        if (blockMessage) {
          await supabase.auth.signOut()
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('error', blockMessage)
          const redirectResponse = NextResponse.redirect(url)
          supabaseResponse.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value)
          })
          return redirectResponse
        }

        // Cache the verification for 5 minutes
        supabaseResponse.cookies.set('user-status-verified', 'true', { maxAge: 300 })
      }
    }
    
    if (!user && !isPublicRoute && !isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Redirect logged-in users away from auth routes (login/forgot) to dashboard
    // But allow them to see /validar pages
    if (user && isPublicRoute && !request.nextUrl.pathname.startsWith('/validar')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (user && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.error('Middleware: Error updating session', error)
  }

  return supabaseResponse
}
