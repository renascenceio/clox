import { NextResponse } from 'next/server'
import { getProjectForViewer, assertProjectOwner, assertProjectAdmin, logActivity } from '@/lib/projects/server'

/**
 * GET    /api/projects/[id]   — full project view (project + my membership + counts)
 * PATCH  /api/projects/[id]   — update settings (admin/owner)
 * DELETE /api/projects/[id]   — soft archive (owner only). Hard delete via ?hard=1.
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getProjectForViewer(id)
    return NextResponse.json({
      project: ctx.project,
      my_role: ctx.member?.role ?? (ctx.project.owner_id === ctx.user.id ? 'owner' : null),
      my_credit_limit_usd: ctx.member?.credit_limit_usd ?? null,
      my_credit_spent_usd: ctx.member?.credit_spent_usd ?? 0,
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await assertProjectAdmin(id)
    const body = await req.json().catch(() => ({}))

    const allowed: Record<string, unknown> = {}
    if (body.title !== undefined) allowed.title = String(body.title).trim()
    if (body.description !== undefined) allowed.description = body.description ? String(body.description) : null
    if (body.model !== undefined) allowed.model = String(body.model)
    if (body.system_prompt !== undefined) allowed.system_prompt = body.system_prompt ? String(body.system_prompt) : null
    if (body.temperature !== undefined) allowed.temperature = Number(body.temperature)
    if (body.max_tokens !== undefined) allowed.max_tokens = Math.floor(Number(body.max_tokens))
    if (body.allow_external !== undefined) allowed.allow_external = Boolean(body.allow_external)
    if (body.default_modality !== undefined && ['text','image','video','audio','research','code'].includes(body.default_modality)) {
      allowed.default_modality = body.default_modality
    }

    if (body.credit_budget_usd !== undefined) {
      allowed.credit_budget_usd = body.credit_budget_usd === null ? null : Number(body.credit_budget_usd)
    }
    if (body.budget_period !== undefined && ['lifetime','monthly'].includes(body.budget_period)) {
      allowed.budget_period = body.budget_period
      if (body.budget_period === 'monthly') {
        const next = new Date()
        next.setMonth(next.getMonth() + 1)
        allowed.budget_resets_at = next.toISOString()
      } else {
        allowed.budget_resets_at = null
      }
    }
    if (body.archived !== undefined) {
      // Archive/unarchive — owner only.
      if (ctx.project.owner_id !== ctx.user.id) {
        return NextResponse.json({ error: 'Only the owner can archive this project.' }, { status: 403 })
      }
      allowed.archived_at = body.archived ? new Date().toISOString() : null
    }

    if (!Object.keys(allowed).length) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('projects')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'project.updated',
      payload: allowed,
    })

    return NextResponse.json({ project: data })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const ctx = await assertProjectOwner(id)

    if (url.searchParams.get('hard') === '1') {
      await ctx.supabase.from('projects').delete().eq('id', id)
      return NextResponse.json({ ok: true, deleted: 'hard' })
    }

    await ctx.supabase
      .from('projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'project.archived',
    })
    return NextResponse.json({ ok: true, deleted: 'archived' })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
