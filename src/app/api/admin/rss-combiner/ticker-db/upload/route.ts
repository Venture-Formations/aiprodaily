import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateCache } from '@/lib/rss-combiner'

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

const BATCH_SIZE = 500

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db/upload' },
  async ({ request }: { request: NextRequest }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have a header row and at least one data row' },
        { status: 400 }
      )
    }

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
    const tickerIdx = header.findIndex((h) => h === 'ticker' || h === 'symbol')
    const nameIdx = header.findIndex(
      (h) => h === 'company_name' || h === 'company' || h === 'name'
    )

    if (tickerIdx === -1 || nameIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must have "ticker" and "company_name" columns' },
        { status: 400 }
      )
    }

    const rows: { ticker: string; company_name: string; updated_at: string }[] = []
    const errors: string[] = []
    const now = new Date().toISOString()

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i])
      const ticker = fields[tickerIdx]?.trim().toUpperCase()
      const companyName = fields[nameIdx]?.trim()

      if (!ticker || !companyName) {
        errors.push(`Row ${i + 1}: missing ticker or company name`)
        continue
      }

      rows.push({ ticker, company_name: companyName, updated_at: now })
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found', errors },
        { status: 400 }
      )
    }

    let upserted = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error: upsertError } = await supabaseAdmin
        .from('ticker_company_names')
        .upsert(batch, { onConflict: 'ticker' })

      if (upsertError) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`)
      } else {
        upserted += batch.length
      }
    }

    invalidateCache()

    return NextResponse.json({
      upserted,
      total: rows.length,
      errors: errors.slice(0, 20),
    })
  }
)
