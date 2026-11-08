import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/shared/lib/middleware-utils'
import { REGION_COOKIE, regionFromGeo } from '@/lib/consent/types'

export async function middleware(request: NextRequest) {
  // API routes are public to the middleware and check the user themselves
  // (refreshing the session when needed). Running getUser here as well
  // added a second round trip to the auth server to every API call.
  const response = request.nextUrl.pathname.startsWith('/api/')
    ? NextResponse.next({ request })
    : await updateSession(request)

  // Country-level hint for the cookie banner (which privacy law and wording
  // apply). Edge geo headers only exist on Vercel; locally the banner falls
  // back to the time zone. Session cookie, no address or IP kept.
  const country = request.headers.get('x-vercel-ip-country')
  if (country) {
    const region = regionFromGeo(country, request.headers.get('x-vercel-ip-country-region'))
    if (request.cookies.get(REGION_COOKIE)?.value !== region) {
      response.cookies.set(REGION_COOKIE, region, {
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        httpOnly: false,
      })
    }
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
