import { NextResponse } from 'next/server'
import { getProjectForViewer, assertProjectAdmin, logActivity, isGenericDomain, emailDomain, generateInviteToken, getServiceClient } from '@/lib/projects/server'

/**
 * GET  /api/projects/[id]/members  — list members + open invites
 * POST /api/projects/[id]/members  — invite a person by email
 *
 * Domain rule:
 *  - if owner has a generic email (gmail etc) → anyone may be invited
 *  - else if project.allow_external is true   → anyone may be invited
 *  - else                                     → only same-domain emails allowed
 *
 * If the email belongs to an existing user we add them directly. If not, we
 * create a token-based project_invites row (the email is sent later — for
 * now the link is returned to the inviter so they can copy/share).
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getProjectForViewer(id)
    const [{ data: members, error: memberErr }, { data: invites }] = await Promise.all([
      ctx.supabase
        .from('project_members')
        .select('id, user_id, email, domain, role, joined_at, invited_at, credit_limit_usd, credit_spent_usd')
        .eq('project_id', id)
        .order('invited_at', { ascending: true }),
      ctx.supabase
        .from('project_invites')
        .select('id, email, role, token, expires_at, accepted_at, created_at, invited_by')
        .eq('project_id', id)
        .is('accepted_at', null),
    ])
    if (memberErr) throw memberErr
    return NextResponse.json({ members: members ?? [], invites: invites ?? [] })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await assertProjectAdmin(id)
    const body = await req.json().catch(() => ({}))
    const rawEmail = String(body.email ?? '').trim().toLowerCase()
    const role = body.role === 'admin' ? 'admin' : 'member'
    const limit = body.credit_limit_usd === null || body.credit_limit_usd === undefined
      ? null : Number(body.credit_limit_usd)

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    // Domain enforcement
    const ownerDomain = (ctx.project.owner_domain ?? '').toLowerCase()
    const ownerIsGeneric = isGenericDomain(ownerDomain)
    const inviteeDomain = emailDomain(rawEmail)

    if (!ctx.project.allow_external && !ownerIsGeneric) {
      if (inviteeDomain !== ownerDomain) {
        return NextResponse.json({
          error: `Only @${ownerDomain} addresses can join this project. Toggle "Allow external collaborators" in settings to invite others.`,
        }, { status: 400 })
      }
    }

    // Already a member?
    const { data: existing } = await ctx.supabase
      .from('project_members')
      .select('id')
      .eq('project_id', id)
      .ilike('email', rawEmail)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'This person is already a member.' }, { status: 409 })
    }

    // Look up the auth.users row by email (service role — RLS would hide it)
    const service = getServiceClient()
    const { data: usersResp } = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
    const target = (usersResp?.users ?? []).find(u => (u.email ?? '').toLowerCase() === rawEmail)

    if (target) {
      // Insert directly as member
      const { data: row, error } = await ctx.supabase
        .from('project_members')
        .insert({
          project_id: id,
          user_id: target.id,
          email: rawEmail,
          role,
          credit_limit_usd: limit,
          joined_at: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (error) throw error
      await logActivity({
        projectId: id,
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? null,
        action: 'member.added',
        targetKind: 'member',
        targetId: row.id,
        payload: { email: rawEmail, role, credit_limit_usd: limit },
      })
      return NextResponse.json({ member: row, invite: null })
    }

    // Otherwise — create a token invite
    const token = generateInviteToken()
    const { data: invite, error } = await ctx.supabase
      .from('project_invites')
      .insert({
        project_id: id,
        invited_by: ctx.user.id,
        email: rawEmail,
        role,
        token,
      })
      .select('*')
      .single()
    if (error) throw error
    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'invite.sent',
      targetKind: 'invite',
      targetId: invite.id,
      payload: { email: rawEmail, role },
    })
    const link = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/invite/${token}`
    return NextResponse.json({ member: null, invite: { ...invite, link } }, { status: 201 })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
