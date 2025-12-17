import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Normalize domain - remove www. prefix and convert to lowercase
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '').trim()
}

/**
 * GET - Fetch all blocked domains for the publication
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

    // Get blocked domains from settings table
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'blocked_domains')
      .maybeSingle()

    if (settingsError) {
      console.error('Error fetching blocked domains:', settingsError)
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    const blockedDomains: string[] = settings?.value
      ? JSON.parse(settings.value)
      : []

    return NextResponse.json({
      success: true,
      domains: blockedDomains
    })

  } catch (error) {
    console.error('Blocked domains GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Add a domain to the blocked list
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

    const normalizedDomain = normalizeDomain(domain)

    if (!normalizedDomain) {
      return NextResponse.json(
        { error: 'Invalid domain' },
        { status: 400 }
      )
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

    // Get current blocked domains
    const { data: currentSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'blocked_domains')
      .maybeSingle()

    let blockedDomains: string[] = currentSettings?.value
      ? JSON.parse(currentSettings.value)
      : []

    // Check if already blocked
    if (blockedDomains.includes(normalizedDomain)) {
      return NextResponse.json({
        success: true,
        message: `Domain "${normalizedDomain}" is already blocked`
      })
    }

    // Add to blocked list
    blockedDomains.push(normalizedDomain)

    // Save back to settings
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .upsert({
        publication_id: newsletter.id,
        key: 'blocked_domains',
        value: JSON.stringify(blockedDomains),
        description: 'List of domains to skip entirely during RSS ingestion',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'publication_id,key'
      })

    if (updateError) {
      console.error('Error adding blocked domain:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[BlockedDomains] Added domain: ${normalizedDomain}`)

    return NextResponse.json({
      success: true,
      message: `Domain "${normalizedDomain}" blocked successfully`,
      domains: blockedDomains
    })

  } catch (error) {
    console.error('Blocked domains POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a domain from the blocked list
 */
export async function DELETE(request: NextRequest) {
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

    const normalizedDomain = normalizeDomain(domain)

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

    // Get current blocked domains
    const { data: currentSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'blocked_domains')
      .maybeSingle()

    let blockedDomains: string[] = currentSettings?.value
      ? JSON.parse(currentSettings.value)
      : []

    // Remove from blocked list
    blockedDomains = blockedDomains.filter(d => d !== normalizedDomain)

    // Save back to settings
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .upsert({
        publication_id: newsletter.id,
        key: 'blocked_domains',
        value: JSON.stringify(blockedDomains),
        description: 'List of domains to skip entirely during RSS ingestion',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'publication_id,key'
      })

    if (updateError) {
      console.error('Error removing blocked domain:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[BlockedDomains] Removed domain: ${normalizedDomain}`)

    return NextResponse.json({
      success: true,
      message: `Domain "${normalizedDomain}" unblocked successfully`,
      domains: blockedDomains
    })

  } catch (error) {
    console.error('Blocked domains DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
