import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Validate IP address format (IPv4 or IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  // IPv6 pattern (simplified - allows full and compressed forms)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  if (ipv4Pattern.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split('.').map(Number)
    return octets.every(octet => octet >= 0 && octet <= 255)
  }

  return ipv6Pattern.test(ip)
}

/**
 * Normalize IP address - trim whitespace
 */
function normalizeIP(ip: string): string {
  return ip.trim()
}

/**
 * GET - Fetch all excluded IPs for a publication
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/excluded-ips' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: excludedIps, error } = await supabaseAdmin
      .from('poll_excluded_ips')
      .select('id, ip_address, reason, added_by, created_at')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Polls] Error fetching excluded IPs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ips: excludedIps || []
    })
  }
)

/**
 * POST - Add an IP to the exclusion list
 * Body: { publication_id, ip_address, reason? }
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/excluded-ips' },
  async ({ request, session }) => {
    const body = await request.json()
    const { publication_id, ip_address, reason } = body

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    if (!ip_address || typeof ip_address !== 'string') {
      return NextResponse.json(
        { error: 'ip_address is required' },
        { status: 400 }
      )
    }

    const normalizedIP = normalizeIP(ip_address)

    if (!isValidIP(normalizedIP)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    // Check if already excluded
    const { data: existing } = await supabaseAdmin
      .from('poll_excluded_ips')
      .select('id')
      .eq('publication_id', publication_id)
      .eq('ip_address', normalizedIP)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: `IP "${normalizedIP}" is already excluded`
      })
    }

    // Insert new exclusion
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('poll_excluded_ips')
      .insert({
        publication_id,
        ip_address: normalizedIP,
        reason: reason || null,
        added_by: session.user.email
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Polls] Error adding excluded IP:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log(`[Polls] Added excluded IP: ${normalizedIP} (reason: ${reason || 'none'})`)

    // Return updated list
    const { data: excludedIps } = await supabaseAdmin
      .from('poll_excluded_ips')
      .select('id, ip_address, reason, added_by, created_at')
      .eq('publication_id', publication_id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      message: `IP "${normalizedIP}" excluded from poll analytics`,
      added: inserted,
      ips: excludedIps || []
    })
  }
)

/**
 * DELETE - Remove an IP from the exclusion list
 * Body: { publication_id, ip_address }
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/excluded-ips' },
  async ({ request }) => {
    const body = await request.json()
    const { publication_id, ip_address } = body

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    if (!ip_address || typeof ip_address !== 'string') {
      return NextResponse.json(
        { error: 'ip_address is required' },
        { status: 400 }
      )
    }

    const normalizedIP = normalizeIP(ip_address)

    // Delete the exclusion
    const { error: deleteError } = await supabaseAdmin
      .from('poll_excluded_ips')
      .delete()
      .eq('publication_id', publication_id)
      .eq('ip_address', normalizedIP)

    if (deleteError) {
      console.error('[Polls] Error removing excluded IP:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log(`[Polls] Removed excluded IP: ${normalizedIP}`)

    // Return updated list
    const { data: excludedIps } = await supabaseAdmin
      .from('poll_excluded_ips')
      .select('id, ip_address, reason, added_by, created_at')
      .eq('publication_id', publication_id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      message: `IP "${normalizedIP}" removed from exclusion list`,
      ips: excludedIps || []
    })
  }
)
