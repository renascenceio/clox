import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTO_SSO_HOSTS, LEGACY_HOSTS, OMMA_ORIGIN, SSO_TRIED_COOKIE, crmSignInUrl, safeNext } from '@/lib/gaia-sso-config'

/** Pages anyone can open without signing in. */
const PUBLIC_PREFIXES = ['/login', '/signup', '/forgot-password', '/auth/', '/invite/', '/privacy', '/cookies', '/terms', '/api/', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/', '/brand/']

/** Account screens a signed-in person doesn't need — send them into the app. */
const SIGNED_OUT_ONLY = ['/login', '/signup', '/forgot-password']

function isPublic(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))
}

export async function updateSession(request: NextRequest) {
  // Clox is now Omma: the old address keeps working by moving to the new one
  // (308 keeps POSTs, so older Sota OS deployments can still make accounts).
  const requestHost = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(':')[0]
  if (LEGACY_HOSTS.includes(requestHost)) {
    return NextResponse.redirect(`${OMMA_ORIGIN}${request.nextUrl.pathname}${request.nextUrl.search}`, 308)
  }

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

  // On Omma's own address, a signed-out visit first asks Sota OS whether
  // they're signed in there (once per browser session).
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(':')[0]
  if (
    !user &&
    process.env.GAIA_SSO_SECRET &&
    AUTO_SSO_HOSTS.includes(host) &&
    request.method === 'GET' &&
    (!isPublic(pathname) || pathname === '/' || pathname === '/login') &&
    !request.nextUrl.searchParams.has('sso') &&
    !request.cookies.get(SSO_TRIED_COOKIE)
  ) {
    const next = pathname === '/login' ? safeNext(request.nextUrl.searchParams.get('redirect')) : pathname === '/' ? '/text' : pathname + search
    const res = redirectKeepingCookies(new URL(crmSignInUrl(`https://${host}`, next)))
    res.cookies.set(SSO_TRIED_COOKIE, '1', { path: '/', sameSite: 'lax', secure: true, httpOnly: true })
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
