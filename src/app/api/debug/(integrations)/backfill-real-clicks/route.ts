import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'

const REAL_CLICK_FIELD = 'real_click' // MailerLite custom field key (lowercase)
const MAILERLITE_RATE_LIMIT_DELAY = 100 // ms between API calls to avoid rate limiting

/**
 * Updates a subscriber's custom field in MailerLite
 */
async function updateMailerLiteField(
  email: string,
  fieldName: string,
  fieldValue: boolean
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) {
    return { success: false, error: 'MAILERLITE_API_KEY not configured' }
  }

  try {
    const response = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          fields: {
            [fieldName]: fieldValue ? 'true' : 'false'
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.message || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Backfill Real_Click field for all subscribers with valid clicks
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const dryRun = searchParams.get('dry_run') === 'true'
  const limit = parseInt(searchParams.get('limit') || '0', 10)

  try {
    const results = {
      dryRun,
      publications: [] as {
        slug: string
        totalClickers: number
        validClickers: number
        updated: number
        failed: number
        errors: string[]
      }[]
    }

    // Get all publications
    const { data: publications, error: pubError } = await supabaseAdmin
      .from('publications')
      .select('id, slug')

    if (pubError || !publications) {
      return NextResponse.json({ error: `Failed to fetch publications: ${pubError?.message}` }, { status: 500 })
    }

    for (const publication of publications) {
      const pubResult = {
        slug: publication.slug,
        totalClickers: 0,
        validClickers: 0,
        updated: 0,
        failed: 0,
        errors: [] as string[]
      }

      // Get excluded IPs for this publication
      const { data: excludedIpsData } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publication.id)

      const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))

      // Get ALL link clicks for this publication (paginated)
      const FETCH_BATCH = 1000
      let allClicks: { subscriber_email: string; ip_address: string }[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: clicks, error: clickError } = await supabaseAdmin
          .from('link_clicks')
          .select('subscriber_email, ip_address')
          .eq('publication_id', publication.id)
          .range(offset, offset + FETCH_BATCH - 1)

        if (clickError) {
          pubResult.errors.push(`Failed to fetch clicks: ${clickError.message}`)
          break
        }

        if (clicks && clicks.length > 0) {
          allClicks = allClicks.concat(clicks)
          offset += FETCH_BATCH
          hasMore = clicks.length === FETCH_BATCH
        } else {
          hasMore = false
        }
      }

      pubResult.totalClickers = new Set(allClicks.map(c => c.subscriber_email.toLowerCase())).size

      // Filter to valid (non-excluded IP) clicks and get unique emails
      const validClicks = allClicks.filter(c => !isIPExcluded(c.ip_address, exclusions))
      const emailsWithValidClicks = Array.from(new Set(validClicks.map(c => c.subscriber_email.toLowerCase())))

      pubResult.validClickers = emailsWithValidClicks.length

      // Apply limit if specified
      const emailsToProcess = limit > 0 ? emailsWithValidClicks.slice(0, limit) : emailsWithValidClicks

      if (!dryRun) {
        // Update each subscriber in MailerLite
        for (const email of emailsToProcess) {
          const result = await updateMailerLiteField(email, REAL_CLICK_FIELD, true)

          if (result.success) {
            pubResult.updated++
            console.log(`[Backfill] Updated ${email}: ${REAL_CLICK_FIELD}=true`)
          } else {
            pubResult.failed++
            if (pubResult.errors.length < 10) {
              pubResult.errors.push(`${email}: ${result.error}`)
            }
            console.error(`[Backfill] Failed ${email}: ${result.error}`)
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, MAILERLITE_RATE_LIMIT_DELAY))
        }

        // Also update local tracking table
        for (const email of emailsToProcess) {
          await supabaseAdmin
            .from('subscriber_real_click_status')
            .upsert({
              publication_id: publication.id,
              subscriber_email: email,
              has_real_click: true,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'publication_id,subscriber_email' })
        }
      }

      results.publications.push(pubResult)
    }

    const totalUpdated = results.publications.reduce((sum, p) => sum + p.updated, 0)
    const totalFailed = results.publications.reduce((sum, p) => sum + p.failed, 0)
    const totalValidClickers = results.publications.reduce((sum, p) => sum + p.validClickers, 0)

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `Dry run complete. Would update ${totalValidClickers} subscribers.`
        : `Backfill complete. Updated ${totalUpdated}, failed ${totalFailed}.`,
      summary: {
        totalValidClickers,
        updated: totalUpdated,
        failed: totalFailed
      },
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Backfill Real Clicks] Error:', error)
    return NextResponse.json({
      error: 'Backfill failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
