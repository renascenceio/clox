import { NextResponse } from 'next/server'
import { getProjectForViewer } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getProjectForViewer(id)
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500)
    const { data, error } = await ctx.supabase
      .from('project_activity')
      .select('id, actor_id, actor_email, action, target_kind, target_id, payload, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return NextResponse.json({ entries: data ?? [] })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
