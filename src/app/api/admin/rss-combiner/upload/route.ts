import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateCache, parseTradeSize } from '@/lib/rss-combiner'
import * as XLSX from 'xlsx'

// Map spreadsheet column headers to our DB columns
const COLUMN_MAP: Record<string, string> = {
  ticker: 'ticker',
  'ticker type': 'ticker_type',
  company: 'company',
  traded: 'traded',
  filed: 'filed',
  transaction: 'transaction',
  trade_size_usd: 'trade_size_usd',
  'trade size (usd)': 'trade_size_usd',
  name: 'name',
  party: 'party',
  district: 'district',
  chamber: 'chamber',
  state: 'state',
  'capitol trades url': 'capitol_trades_url',
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/_/g, ' ')
}

function parseExcelDate(val: any): string | null {
  if (!val) return null
  // XLSX serial date number
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  // Already a string date
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
  }
  return null
}

const BATCH_SIZE = 1000

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/upload' },
  async ({ request }: { request: NextRequest }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in workbook' }, { status: 400 })
    }

    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 })
    }

    // Build column index from first row keys
    const rawHeaders = Object.keys(rows[0])
    const colIndex: Record<string, string> = {}
    for (const h of rawHeaders) {
      const normalized = normalizeHeader(h)
      const dbCol = COLUMN_MAP[normalized]
      if (dbCol) {
        colIndex[h] = dbCol
      }
    }

    if (!Object.values(colIndex).includes('ticker')) {
      return NextResponse.json({ error: 'XLSX must have a "Ticker" column' }, { status: 400 })
    }
    if (!Object.values(colIndex).includes('traded')) {
      return NextResponse.json({ error: 'XLSX must have a "Traded" column' }, { status: 400 })
    }

    // Parse rows into trade objects
    const trades: any[] = []
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const trade: Record<string, any> = {}

      for (const [rawHeader, dbCol] of Object.entries(colIndex)) {
        const val = row[rawHeader]
        if (dbCol === 'traded' || dbCol === 'filed') {
          trade[dbCol] = parseExcelDate(val)
        } else {
          trade[dbCol] = val != null ? String(val).trim() : null
        }
      }

      if (!trade.ticker) {
        errors.push(`Row ${i + 2}: missing ticker`)
        continue
      }
      if (!trade.traded) {
        errors.push(`Row ${i + 2}: missing or invalid traded date`)
        continue
      }

      // Parse trade size
      trade.trade_size_parsed = parseTradeSize(trade.trade_size_usd)

      trades.push(trade)
    }

    if (trades.length === 0) {
      return NextResponse.json(
        { error: 'No valid trade rows found', errors },
        { status: 400 }
      )
    }

    // Truncate existing trades
    const { error: truncError } = await supabaseAdmin
      .from('congress_trades')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')

    if (truncError) {
      console.error('[RSS-Combiner] Truncate failed:', truncError.message)
      return NextResponse.json({ error: 'Failed to clear existing trades' }, { status: 500 })
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

    // Get unique ticker count
    const uniqueTickers = new Set(trades.map((t) => t.ticker.toUpperCase())).size

    return NextResponse.json({
      inserted,
      total: rows.length,
      uniqueTickers,
      errors: errors.slice(0, 20), // Cap error list
    })
  }
)
