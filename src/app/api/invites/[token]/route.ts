import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient, logActivity } from '@/lib/projects/server'

/**
 * GET  /api/invites/[token]    — preview the invite (project title, role, expiry)
 * POST /api/invites/[token]    — accept it (must be authed; email match required)
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const service = getServiceClient()
    const { data: invite } = await service
      .from('project_invites')
      .select('id, project_id, email, role, expires_at, accepted_at, projects(title, owner_email)')
      .eq('token', token)
      .maybeSingle()
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.accepted_at) return NextResponse.json({ error: 'This invite has already been used.' }, { status: 410 })
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 })
    }
    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      project_id: invite.project_id,
      project_title: (invite.projects as { title?: string } | null)?.title ?? 'Project',
      project_owner: (invite.projects as { owner_email?: string } | null)?.owner_email ?? null,
      expires_at: invite.expires_at,
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to accept this invite.' }, { status: 401 })

    const service = getServiceClient()
    const { data: invite } = await service
      .from('project_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.accepted_at) return NextResponse.json({ error: 'This invite has already been used.' }, { status: 410 })
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 })
    }
    if ((user.email ?? '').toLowerCase() !== String(invite.email).toLowerCase()) {
      return NextResponse.json({
        error: `This invite is addressed to ${invite.email}. Sign in with that email to accept.`,
      }, { status: 403 })
    }

    // Already a member? mark accepted, no duplicate row
    const { data: existing } = await service
      .from('project_members')
      .select('id')
      .eq('project_id', invite.project_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!existing) {
      await service.from('project_members').insert({
        project_id: invite.project_id,
        user_id: user.id,
        email: user.email,
        role: invite.role,
        joined_at: new Date().toISOString(),
      })
    }
    await service
      .from('project_invites')
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq('id', invite.id)

    await logActivity({
      projectId: invite.project_id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'invite.accepted',
      targetKind: 'invite',
      targetId: invite.id,
      payload: { email: user.email },
    })

    return NextResponse.json({ ok: true, project_id: invite.project_id })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
