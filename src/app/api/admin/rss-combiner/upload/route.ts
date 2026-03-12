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

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/upload' },
  async ({ request }: { request: NextRequest }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    }

    // Parse header
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
    const urlIdx = header.findIndex((h) => h === 'url' || h === 'feed_url' || h === 'rss_url')
    const labelIdx = header.findIndex((h) => h === 'label' || h === 'name' || h === 'source')

    if (urlIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must have a "url" column' },
        { status: 400 }
      )
    }

    // Parse rows
    const uploadedUrls: { url: string; label: string }[] = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i])
      const url = fields[urlIdx]?.trim()
      const label = labelIdx !== -1 ? fields[labelIdx]?.trim() || '' : ''

      if (!url) {
        errors.push(`Row ${i + 1}: missing URL`)
        continue
      }

      try {
        new URL(url)
      } catch {
        errors.push(`Row ${i + 1}: invalid URL "${url}"`)
        continue
      }

      uploadedUrls.push({ url, label })
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid URLs found in CSV', errors },
        { status: 400 }
      )
    }

    // Get existing sources
    const { data: existing } = await supabaseAdmin
      .from('combined_feed_sources')
      .select('id, url, label, is_active')

    const existingMap = new Map(
      (existing || []).map((s) => [s.url, s])
    )

    let created = 0
    let updated = 0
    let deactivated = 0

    const uploadedUrlSet = new Set(uploadedUrls.map((u) => u.url))

    const now = new Date().toISOString()

    // Batch: collect inserts and updates
    const toInsert: { url: string; label: string; is_active: boolean; is_excluded: boolean }[] = []
    const toUpdateIds: string[] = []

    for (const { url, label } of uploadedUrls) {
      const existingSource = existingMap.get(url)

      if (existingSource) {
        if (existingSource.label !== label || !existingSource.is_active) {
          toUpdateIds.push(existingSource.id)
          // Update label individually since labels may differ per row
          await supabaseAdmin
            .from('combined_feed_sources')
            .update({ label, is_active: true, updated_at: now })
            .eq('id', existingSource.id)
          updated++
        }
      } else {
        toInsert.push({ url, label, is_active: true, is_excluded: false })
      }
    }

    // Batch insert all new sources at once
    if (toInsert.length > 0) {
      await supabaseAdmin
        .from('combined_feed_sources')
        .insert(toInsert)
      created = toInsert.length
    }

    // Batch deactivate: all active sources not in upload set
    const toDeactivateIds = (existing || [])
      .filter((s) => s.is_active && !uploadedUrlSet.has(s.url))
      .map((s) => s.id)

    if (toDeactivateIds.length > 0) {
      await supabaseAdmin
        .from('combined_feed_sources')
        .update({ is_active: false, updated_at: now })
        .in('id', toDeactivateIds)
      deactivated = toDeactivateIds.length
    }

    invalidateCache()

    return NextResponse.json({
      created,
      updated,
      deactivated,
      errors,
      total: uploadedUrls.length,
    })
  }
)
