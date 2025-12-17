import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    return hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * GET - Fetch domains with extraction failures as suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    // Get current blocked domains to exclude from suggestions
    const { data: blockedSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'blocked_domains')
      .maybeSingle()

    const blockedDomains: string[] = blockedSettings?.value
      ? JSON.parse(blockedSettings.value)
      : []

    // Get ignored domains (domains user has dismissed from suggestions)
    const { data: ignoredSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'ignored_domain_suggestions')
      .maybeSingle()

    const ignoredDomains: string[] = ignoredSettings?.value
      ? JSON.parse(ignoredSettings.value)
      : []

    // Get posts with extraction failures
    const { data: failedPosts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('source_url, extraction_status, extraction_error')
      .in('extraction_status', ['blocked', 'failed', 'timeout', 'paywall', 'login_required'])

    if (postsError) {
      console.error('Error fetching failed posts:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    // Aggregate by domain
    const domainStats: Map<string, {
      count: number
      errors: Map<string, number>
      statuses: Map<string, number>
      latestUrl: string
    }> = new Map()

    failedPosts?.forEach(post => {
      if (!post.source_url) return

      const domain = extractDomain(post.source_url)
      if (!domain) return

      // Skip already blocked or ignored domains
      if (blockedDomains.includes(domain) || ignoredDomains.includes(domain)) return

      if (!domainStats.has(domain)) {
        domainStats.set(domain, {
          count: 0,
          errors: new Map(),
          statuses: new Map(),
          latestUrl: post.source_url
        })
      }

      const stats = domainStats.get(domain)!
      stats.count++
      // Keep updating latestUrl (last one wins, which is fine for a sample)
      stats.latestUrl = post.source_url

      // Track error types
      const error = post.extraction_error || 'Unknown error'
      stats.errors.set(error, (stats.errors.get(error) || 0) + 1)

      // Track status types
      const status = post.extraction_status || 'failed'
      stats.statuses.set(status, (stats.statuses.get(status) || 0) + 1)
    })

    // Convert to array and sort by failure count
    const suggestions = Array.from(domainStats.entries())
      .map(([domain, stats]) => {
        // Find most common error
        let mostCommonError = 'Unknown'
        let maxErrorCount = 0
        stats.errors.forEach((count, error) => {
          if (count > maxErrorCount) {
            maxErrorCount = count
            mostCommonError = error
          }
        })

        // Find most common status
        let mostCommonStatus = 'failed'
        let maxStatusCount = 0
        stats.statuses.forEach((count, status) => {
          if (count > maxStatusCount) {
            maxStatusCount = count
            mostCommonStatus = status
          }
        })

        return {
          domain,
          failure_count: stats.count,
          most_common_error: mostCommonError,
          most_common_status: mostCommonStatus,
          sample_url: stats.latestUrl
        }
      })
      .filter(s => s.failure_count >= 1) // Only show domains with at least 1 failure
      .sort((a, b) => b.failure_count - a.failure_count)
      .slice(0, 20) // Limit to top 20 suggestions

    return NextResponse.json({
      success: true,
      suggestions
    })

  } catch (error) {
    console.error('Blocked domains suggestions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Ignore a domain suggestion (dismiss without blocking)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { domain } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      )
    }

    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '').trim()

    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    // Get current ignored domains
    const { data: currentSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'ignored_domain_suggestions')
      .maybeSingle()

    let ignoredDomains: string[] = currentSettings?.value
      ? JSON.parse(currentSettings.value)
      : []

    // Add to ignored list if not already there
    if (!ignoredDomains.includes(normalizedDomain)) {
      ignoredDomains.push(normalizedDomain)
    }

    // Save back to settings
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .upsert({
        publication_id: newsletter.id,
        key: 'ignored_domain_suggestions',
        value: JSON.stringify(ignoredDomains),
        description: 'List of domains to ignore in blocked domain suggestions',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'publication_id,key'
      })

    if (updateError) {
      console.error('Error ignoring domain suggestion:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Domain "${normalizedDomain}" ignored`
    })

  } catch (error) {
    console.error('Ignore domain suggestion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
