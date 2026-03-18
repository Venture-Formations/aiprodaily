import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/article-images/members
 * Returns all distinct congress member names for autocomplete suggestions.
 * Uses SELECT DISTINCT to handle the 110K+ row congress_trades table efficiently.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-images/members' },
  async () => {
    const { data, error } = await supabaseAdmin.rpc('get_distinct_congress_members')

    if (error) {
      // Fallback: if RPC doesn't exist, use a paginated approach
      console.warn('[article-images/members] RPC not found, using fallback query:', error.message)
      return await fallbackQuery()
    }

    return NextResponse.json({ members: data || [] })
  }
)

/**
 * Fallback if the RPC function doesn't exist yet.
 * Paginates through congress_trades and deduplicates in memory.
 */
async function fallbackQuery(): Promise<NextResponse> {
  const PAGE_SIZE = 1000
  const seen = new Map<string, { name: string; party: string; state: string; chamber: string }>()
  let offset = 0

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('congress_trades')
      .select('name, party, state, chamber')
      .not('name', 'is', null)
      .order('name')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) break

    for (const row of data) {
      if (row.name && !seen.has(row.name)) {
        seen.set(row.name, {
          name: row.name,
          party: row.party || '',
          state: row.state || '',
          chamber: row.chamber || '',
        })
      }
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const members = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ members })
}
