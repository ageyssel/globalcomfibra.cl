import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Verificamos si el usuario tiene una sesión activa
  const { data: { session } } = await supabase.auth.getSession()

  // Si intenta entrar a cualquier ruta que empiece con /dashboard y NO hay sesión...
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    // Lo expulsamos y lo enviamos de vuelta al /login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si intenta entrar al /login pero YA tiene una sesión activa...
  if (request.nextUrl.pathname === '/login' && session) {
    // Lo enviamos directo a su portal para que no tenga que volver a poner su clave
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

// Configuración para que el middleware solo vigile el dashboard y el login
export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}