import { NextResponse } from 'next/server'
import { getProjectForViewer, getServiceClient } from '@/lib/projects/server'

/**
 * GET /api/projects/[id]/usage
 *   ?since=YYYY-MM-DD  ?member=userId  ?limit=200  ?cursor=ISO
 *
 * Returns paginated usage rows + by_day / by_member / by_modality / by_model
 * aggregates derived in JS (low cardinality; project usage is small).
 */

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await getProjectForViewer(id) // RLS gate

    const url = new URL(req.url)
    const since = url.searchParams.get('since')
    const member = url.searchParams.get('member')
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500)
    const cursor = url.searchParams.get('cursor')

    // Use service client to allow project-scoped reads of any member's rows.
    const service = getServiceClient()
    let q = service
      .from('usage_logs')
      .select('id, user_id, modality, chat_id, provider, model, prompt_tokens, completion_tokens, cost_usd, created_at, domain')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (since) q = q.gte('created_at', new Date(since).toISOString())
    if (member) q = q.eq('user_id', member)
    if (cursor) q = q.lt('created_at', cursor)

    const { data: rows, error } = await q
    if (error) throw error

    // Enrich with member emails
    const userIds = Array.from(new Set((rows ?? []).map(r => r.user_id).filter(Boolean) as string[]))
    const usersById = new Map<string, string>()
    if (userIds.length) {
      const { data: members } = await service
        .from('project_members')
        .select('user_id, email')
        .eq('project_id', id)
        .in('user_id', userIds)
      for (const m of members ?? []) usersById.set(m.user_id as string, m.email as string)
    }

    const entries = (rows ?? []).map(r => ({
      ...r,
      cost_usd: Number(r.cost_usd ?? 0),
      member_email: r.user_id ? usersById.get(r.user_id) ?? null : null,
    }))

    // Aggregates
    const byDay = new Map<string, { spend: number; calls: number }>()
    const byMember = new Map<string, { email: string | null; spend: number; calls: number }>()
    const byModality = new Map<string, { spend: number; calls: number }>()
    const byModel = new Map<string, { spend: number; calls: number }>()

    for (const r of entries) {
      const day = r.created_at.slice(0, 10)
      const dAcc = byDay.get(day) ?? { spend: 0, calls: 0 }
      dAcc.spend += r.cost_usd; dAcc.calls += 1; byDay.set(day, dAcc)

      const mid = r.user_id ?? 'unknown'
      const mAcc = byMember.get(mid) ?? { email: r.member_email, spend: 0, calls: 0 }
      mAcc.spend += r.cost_usd; mAcc.calls += 1; byMember.set(mid, mAcc)

      const mo = (r.modality ?? r.provider ?? 'text') as string
      const moAcc = byModality.get(mo) ?? { spend: 0, calls: 0 }
      moAcc.spend += r.cost_usd; moAcc.calls += 1; byModality.set(mo, moAcc)

      const md = (r.model ?? 'unknown') as string
      const mdAcc = byModel.get(md) ?? { spend: 0, calls: 0 }
      mdAcc.spend += r.cost_usd; mdAcc.calls += 1; byModel.set(md, mdAcc)
    }

    return NextResponse.json({
      entries,
      next_cursor: entries.length === limit ? entries[entries.length - 1].created_at : null,
      by_day: Array.from(byDay, ([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
      by_member: Array.from(byMember, ([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.spend - a.spend),
      by_modality: Array.from(byModality, ([modality, v]) => ({ modality, ...v })).sort((a, b) => b.spend - a.spend),
      by_model: Array.from(byModel, ([model, v]) => ({ model, ...v })).sort((a, b) => b.spend - a.spend),
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
