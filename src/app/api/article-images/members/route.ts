import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/article-images/members?q=nancy
 * Returns distinct congress member names for autocomplete suggestions.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-images/members' },
  async ({ request }) => {
    const q = request.nextUrl.searchParams.get('q') || ''

    let query = supabaseAdmin
      .from('congress_trades')
      .select('name, party, state, chamber')
      .not('name', 'is', null)

    if (q.length >= 2) {
      query = query.ilike('name', `%${q}%`)
    }

    const { data, error } = await query
      .order('name')
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Deduplicate by name (keep first occurrence which has party/state/chamber)
    const seen = new Set<string>()
    const members: { name: string; party: string; state: string; chamber: string }[] = []

    for (const row of data || []) {
      if (!row.name || seen.has(row.name)) continue
      seen.add(row.name)
      members.push({
        name: row.name,
        party: row.party || '',
        state: row.state || '',
        chamber: row.chamber || '',
      })
    }

    return NextResponse.json({ members })
  }
)
