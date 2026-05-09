import { NextResponse } from 'next/server'
import { requireUser, logActivity } from '@/lib/projects/server'

/**
 * GET  /api/projects        — list projects the caller can see (owned + member)
 * POST /api/projects        — create a new project
 *
 * Both rely on RLS for visibility; we just shape the response and emit an
 * activity event on create.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, supabase } = await requireUser()
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, description, model, owner_id, owner_email, owner_domain, credit_budget_usd, credit_spent_usd, budget_period, budget_resets_at, archived_at, allow_external, default_modality, last_activity_at, created_at, updated_at')
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('last_activity_at', { ascending: false })
    if (error) throw error

    // Counts in parallel
    const ids = (data ?? []).map(p => p.id)
    const [{ data: members }, { data: chats }] = await Promise.all([
      supabase.from('project_members').select('project_id, role').in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('chats').select('id, project_id').in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    ])

    const memberCount = new Map<string, number>()
    const myRole = new Map<string, string>()
    for (const m of (members ?? [])) {
      memberCount.set(m.project_id as string, (memberCount.get(m.project_id as string) ?? 0) + 1)
    }
    const chatCount = new Map<string, number>()
    for (const c of (chats ?? [])) {
      chatCount.set(c.project_id as string, (chatCount.get(c.project_id as string) ?? 0) + 1)
    }

    // Re-query my own membership rows to fill myRole quickly
    const { data: mine } = await supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', user.id)
    for (const m of (mine ?? [])) {
      myRole.set(m.project_id as string, m.role as string)
    }

    return NextResponse.json({
      projects: (data ?? []).map(p => ({
        ...p,
        member_count: memberCount.get(p.id) ?? 0,
        chat_count: chatCount.get(p.id) ?? 0,
        my_role: myRole.get(p.id) ?? (p.owner_id === user.id ? 'owner' : 'member'),
      })),
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await requireUser()
    const body = await req.json().catch(() => ({}))

    const title = (body.title ?? '').toString().trim() || 'New project'
    const description = body.description ? String(body.description).trim() : null
    const model = body.model ? String(body.model) : 'gemini-2.5-flash'
    const allowExternal = Boolean(body.allow_external)
    const budget = body.credit_budget_usd === null || body.credit_budget_usd === undefined
      ? null
      : Number(body.credit_budget_usd)
    const period = body.budget_period === 'monthly' ? 'monthly' : 'lifetime'
    const defaultModality = ['text','image','video','audio','research','code'].includes(body.default_modality)
      ? body.default_modality : 'text'
    const systemPrompt = body.system_prompt ? String(body.system_prompt) : null

    const insertable = {
      title,
      description,
      model,
      owner_id: user.id,
      owner_email: user.email!,
      credit_budget_usd: budget,
      budget_period: period,
      budget_resets_at: period === 'monthly'
        ? new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
        : null,
      allow_external: allowExternal,
      default_modality: defaultModality,
      system_prompt: systemPrompt,
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert(insertable)
      .select('*')
      .single()
    if (error) throw error

    await logActivity({
      projectId: project.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'project.created',
      targetKind: 'project',
      targetId: project.id,
      payload: { title: project.title, budget_usd: budget, period },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
