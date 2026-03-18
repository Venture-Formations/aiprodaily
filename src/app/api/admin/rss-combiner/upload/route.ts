import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateCache, invalidateTradesCache, parseTradeSize } from '@/lib/rss-combiner'
import { z } from 'zod'

const BATCH_SIZE = 1000

const tradeRowSchema = z.object({
  ticker: z.string().min(1),
  ticker_type: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  traded: z.string().min(1),
  filed: z.string().nullable().optional(),
  transaction: z.string().nullable().optional(),
  trade_size_usd: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  party: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  chamber: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  capitol_trades_url: z.string().nullable().optional(),
})

const uploadSchema = z.object({
  trades: z.array(tradeRowSchema).min(1, 'At least one trade row required'),
  append: z.boolean().optional(), // true = skip truncate (for chunked uploads after first batch)
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/upload', inputSchema: uploadSchema },
  async ({ input }: { input: z.infer<typeof uploadSchema>; request: NextRequest }) => {
    const rows = input.trades
    const errors: string[] = []

    // Build trade objects with parsed size
    const trades: Record<string, any>[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.ticker || !row.traded) {
        errors.push(`Row ${i + 1}: missing ticker or traded date`)
        continue
      }
      trades.push({
        ...row,
        ticker: row.ticker.trim(),
        trade_size_parsed: parseTradeSize(row.trade_size_usd),
      })
    }

    if (trades.length === 0) {
      return NextResponse.json(
        { error: 'No valid trade rows found', errors },
        { status: 400 }
      )
    }

    // Truncate existing trades (skip if appending a subsequent chunk)
    if (!input.append) {
      const { error: truncError } = await supabaseAdmin
        .from('congress_trades')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000')

      if (truncError) {
        console.error('[RSS-Combiner] Truncate failed:', truncError.message)
        return NextResponse.json({ error: 'Failed to clear existing trades' }, { status: 500 })
      }
    }

    // Batch insert
    let inserted = 0
    for (let i = 0; i < trades.length; i += BATCH_SIZE) {
      const batch = trades.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabaseAdmin
        .from('congress_trades')
        .insert(batch)

      if (insertError) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`)
      } else {
        inserted += batch.length
      }
    }

    invalidateCache()
    invalidateTradesCache()

    const uniqueTickers = new Set(trades.map((t) => t.ticker.toUpperCase())).size

    return NextResponse.json({
      inserted,
      total: rows.length,
      uniqueTickers,
      errors: errors.slice(0, 20),
    })
  }
)
