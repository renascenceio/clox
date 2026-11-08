import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Pages anyone can open without signing in. */
const PUBLIC_PREFIXES = ['/login', '/signup', '/forgot-password', '/auth/', '/invite/', '/privacy', '/cookies', '/terms', '/api/']

/** Account screens a signed-in person doesn't need — send them into the app. */
const SIGNED_OUT_ONLY = ['/login', '/signup', '/forgot-password']

function isPublic(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  const redirectKeepingCookies = (url: URL) => {
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?redirect=${encodeURIComponent(pathname + search)}`
    return redirectKeepingCookies(url)
  }

  if (user && SIGNED_OUT_ONLY.some((p) => pathname === p)) {
    const target = request.nextUrl.searchParams.get('redirect')
    const url = request.nextUrl.clone()
    url.pathname = target && target.startsWith('/') && !target.startsWith('//') ? target.split('?')[0] : '/text'
    url.search = target && target.includes('?') ? target.slice(target.indexOf('?')) : ''
    return redirectKeepingCookies(url)
  }

  return response
}
