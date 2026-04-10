import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Allow access if verification mode is on or if we are using dummy keys
  const isDummy = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('dummy.supabase.co')
  const hasMockSession = request.cookies.get('mock-session')?.value === 'true'

  if (process.env.VERIFICATION_MODE === 'true' || (isDummy && hasMockSession)) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Only attempt real auth if we have valid-looking keys
  if (!isDummy && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

    const PUBLIC_PATHS = ['/login', '/register', '/auth', '/api', '/']
    const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

    if (!user && !isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
