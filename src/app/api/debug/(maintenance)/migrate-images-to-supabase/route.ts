import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

export const maxDuration = 300

interface MigrationResult {
  table: string
  column: string
  id: string
  oldUrl: string
  newUrl: string | null
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

const GITHUB_URL_PATTERNS = [
  'raw.githubusercontent.com',
  'github.com',
  'cdn.jsdelivr.net/gh/',
]

function isGitHubUrl(url: string | null): boolean {
  if (!url) return false
  return GITHUB_URL_PATTERNS.some(p => url.includes(p))
}

function isAlreadyMigrated(url: string | null): boolean {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return (
      hostname === 'supabase.co' ||
      hostname.endsWith('.supabase.co') ||
      hostname === 'img.aiprodaily.com'
    )
  } catch {
    return false
  }
}

/**
 * Migration endpoint: scans all DB tables for GitHub-hosted image URLs,
 * downloads them, optimizes via Tinify, uploads to Supabase Storage,
 * and updates the database records.
 *
 * GET /api/debug/(maintenance)/migrate-images-to-supabase?dry_run=true
 * GET /api/debug/(maintenance)/migrate-images-to-supabase?dry_run=false&batch_size=50
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dry_run') !== 'false'
    const batchSize = Math.min(parseInt(searchParams.get('batch_size') || '50'), 200)
    const tableFilter = searchParams.get('table') || null

    const storage = new SupabaseImageStorage()
    const results: MigrationResult[] = []

    const tablesToMigrate: Array<{
      table: string
      idColumn: string
      imageColumns: string[]
    }> = [
      { table: 'rss_posts', idColumn: 'id', imageColumns: ['image_url'] },
      { table: 'images', idColumn: 'id', imageColumns: ['variant_16x9_url'] },
      { table: 'manual_articles', idColumn: 'id', imageColumns: ['image_url'] },
      { table: 'polls', idColumn: 'id', imageColumns: ['image_url'] },
      { table: 'text_box_modules', idColumn: 'id', imageColumns: ['static_image_url', 'generated_image_url'] },
      { table: 'feedback_module_members', idColumn: 'id', imageColumns: ['image_url'] },
      { table: 'events', idColumn: 'id', imageColumns: ['image_url', 'original_image_url', 'cropped_image_url'] },
      { table: 'sparkloop_recommendations', idColumn: 'id', imageColumns: ['publication_logo'] },
    ]

    const filteredTables = tableFilter
      ? tablesToMigrate.filter(t => t.table === tableFilter)
      : tablesToMigrate

    for (const { table, idColumn, imageColumns } of filteredTables) {
      const selectCols = [idColumn, ...imageColumns].join(', ')

      const { data: rows, error } = await supabaseAdmin
        .from(table)
        .select(selectCols)
        .limit(batchSize)

      if (error) {
        results.push({
          table, column: '*', id: '-', oldUrl: '-', newUrl: null,
          status: 'failed', error: `Query error: ${error.message}`
        })
        continue
      }

      if (!rows) continue

      for (const row of rows as Record<string, any>[]) {
        for (const col of imageColumns) {
          const currentUrl = row[col] as string | null

          if (!currentUrl || !isGitHubUrl(currentUrl)) continue
          if (isAlreadyMigrated(currentUrl)) continue

          const rowId = String(row[idColumn])

          if (dryRun) {
            results.push({
              table, column: col, id: rowId,
              oldUrl: currentUrl, newUrl: null, status: 'skipped',
              error: 'Dry run'
            })
            continue
          }

          try {
            const newUrl = await storage.uploadImage(currentUrl, `Migration: ${table}.${col}`)

            if (newUrl) {
              const { error: updateError } = await supabaseAdmin
                .from(table)
                .update({ [col]: newUrl })
                .eq(idColumn, rowId)

              if (updateError) {
                results.push({
                  table, column: col, id: rowId,
                  oldUrl: currentUrl, newUrl, status: 'failed',
                  error: `DB update failed: ${updateError.message}`
                })
              } else {
                results.push({
                  table, column: col, id: rowId,
                  oldUrl: currentUrl, newUrl, status: 'success'
                })
              }
            } else {
              results.push({
                table, column: col, id: rowId,
                oldUrl: currentUrl, newUrl: null, status: 'failed',
                error: 'Upload returned null'
              })
            }
          } catch (err) {
            results.push({
              table, column: col, id: rowId,
              oldUrl: currentUrl, newUrl: null, status: 'failed',
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }
      }
    }

    // Also handle publication_business_settings (special structure)
    if (!tableFilter || tableFilter === 'publication_business_settings') {
      const { data: bizSettings } = await supabaseAdmin
        .from('publication_business_settings')
        .select('publication_id, header_image_url, logo_url, website_header_url')
        .limit(batchSize)

      if (bizSettings) {
        for (const row of bizSettings) {
          for (const col of ['header_image_url', 'logo_url', 'website_header_url'] as const) {
            const currentUrl = row[col] as string | null
            if (!currentUrl || !isGitHubUrl(currentUrl)) continue
            if (isAlreadyMigrated(currentUrl)) continue

            if (dryRun) {
              results.push({
                table: 'publication_business_settings', column: col,
                id: row.publication_id, oldUrl: currentUrl, newUrl: null,
                status: 'skipped', error: 'Dry run'
              })
              continue
            }

            try {
              const type = col === 'logo_url' ? 'logo' : 'header' as const
              const buffer = await downloadImage(currentUrl)
              if (!buffer) {
                results.push({
                  table: 'publication_business_settings', column: col,
                  id: row.publication_id, oldUrl: currentUrl, newUrl: null,
                  status: 'failed', error: 'Download failed'
                })
                continue
              }

              const newUrl = await storage.uploadBusinessImage(buffer, type, row.publication_id)

              if (newUrl) {
                await supabaseAdmin
                  .from('publication_business_settings')
                  .update({ [col]: newUrl })
                  .eq('publication_id', row.publication_id)

                results.push({
                  table: 'publication_business_settings', column: col,
                  id: row.publication_id, oldUrl: currentUrl, newUrl,
                  status: 'success'
                })
              }
            } catch (err) {
              results.push({
                table: 'publication_business_settings', column: col,
                id: row.publication_id, oldUrl: currentUrl, newUrl: null,
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error'
              })
            }
          }
        }
      }
    }

    // Also handle app_settings with image URLs
    if (!tableFilter || tableFilter === 'app_settings') {
      const imageKeys = ['header_image_url', 'logo_url', 'website_header_url']
      const { data: appSettings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', imageKeys)

      if (appSettings) {
        for (const setting of appSettings) {
          if (!isGitHubUrl(setting.value)) continue
          if (isAlreadyMigrated(setting.value)) continue

          if (dryRun) {
            results.push({
              table: 'app_settings', column: 'value',
              id: setting.key, oldUrl: setting.value, newUrl: null,
              status: 'skipped', error: 'Dry run'
            })
            continue
          }

          try {
            const newUrl = await storage.uploadImage(setting.value, `Migration: app_settings.${setting.key}`)
            if (newUrl) {
              await supabaseAdmin
                .from('app_settings')
                .update({ value: newUrl })
                .eq('key', setting.key)

              results.push({
                table: 'app_settings', column: 'value',
                id: setting.key, oldUrl: setting.value, newUrl,
                status: 'success'
              })
            }
          } catch (err) {
            results.push({
              table: 'app_settings', column: 'value',
              id: setting.key, oldUrl: setting.value, newUrl: null,
              status: 'failed',
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }
      }
    }

    const summary = {
      dryRun,
      batchSize,
      tableFilter,
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      byTable: Object.fromEntries(
        Array.from(new Set(results.map(r => r.table))).map(t => [
          t,
          {
            total: results.filter(r => r.table === t).length,
            success: results.filter(r => r.table === t && r.status === 'success').length,
            failed: results.filter(r => r.table === t && r.status === 'failed').length,
          }
        ])
      )
    }

    return NextResponse.json({
      migration: 'GitHub to Supabase Image Migration',
      summary,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AI-Pro-Daily/1.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}
