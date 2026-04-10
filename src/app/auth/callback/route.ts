import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/text'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if profile is complete (has first_name and company)
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, company')
        .eq('id', data.user.id)
        .single()

      const isProfileComplete = profile?.first_name && profile?.company

      if (!isProfileComplete) {
        // New user — send to registration
        return NextResponse.redirect(`${origin}/register`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
