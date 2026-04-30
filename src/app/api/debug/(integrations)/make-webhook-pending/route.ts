import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/debug/make-webhook-pending?publication_id=X
 *
 * Read-only health view of the make_webhook_fires lifecycle.
 * Returns counts by status, oldest pending age, and expired-reason distribution.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/make-webhook-pending' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('make_webhook_fires')
      .select('status, expired_reason, created_at, poll_attempts')
      .eq('publication_id', publicationId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const counts = { pending: 0, fired: 0, expired: 0 }
    const expiredByReason: Record<string, number> = {}
    let oldestPendingMs: number | null = null
    const pollAttemptsAll: number[] = []
    const now = Date.now()

    for (const r of rows) {
      const status = r.status as 'pending' | 'fired' | 'expired'
      counts[status] = (counts[status] || 0) + 1
      if (status === 'expired' && r.expired_reason) {
        expiredByReason[r.expired_reason] = (expiredByReason[r.expired_reason] || 0) + 1
      }
      if (status === 'pending') {
        const ageMs = now - new Date(r.created_at).getTime()
        if (oldestPendingMs === null || ageMs > oldestPendingMs) oldestPendingMs = ageMs
        pollAttemptsAll.push(r.poll_attempts ?? 0)
      }
    }

    pollAttemptsAll.sort((a, b) => a - b)
    const p95 =
      pollAttemptsAll.length === 0
        ? 0
        : pollAttemptsAll[Math.min(pollAttemptsAll.length - 1, Math.floor(pollAttemptsAll.length * 0.95))]

    return NextResponse.json({
      publicationId,
      counts,
      expiredByReason,
      oldestPendingHours: oldestPendingMs ? Math.round(oldestPendingMs / 3_600_000) : null,
      p95PollAttempts: p95,
    })
  }
)
