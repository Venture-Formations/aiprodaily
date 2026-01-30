import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidIP, isValidCIDR, parseCIDR, parseIPInput } from '@/lib/ip-utils'

/**
 * Unified IP Exclusion API
 * Manages excluded IPs for filtering poll responses and link click analytics
 * Supports both single IPs and CIDR ranges
 */

/**
 * GET - Fetch all excluded IPs for a publication
 * Query params: publication_id (required)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Fetch all excluded IPs - use explicit limit to avoid Supabase's 1000 row default
    const { data: excludedIps, error } = await supabaseAdmin
      .from('excluded_ips')
      .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      console.error('[IP Exclusion] Error fetching excluded IPs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ips: excludedIps || []
    })

  } catch (error) {
    console.error('[IP Exclusion] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Add an IP or CIDR range to the exclusion list
 * Body: { publication_id, ip_address, reason? }
 * ip_address can be a single IP (192.168.1.1) or CIDR range (192.168.1.0/24)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const trimmedInput = ip_address.trim()

    // Parse input - could be single IP or CIDR
    const parsed = parseIPInput(trimmedInput)

    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid IP address or CIDR range format. Use format like "192.168.1.1" or "192.168.1.0/24"' },
        { status: 400 }
      )
    }

    // Check if already excluded (exact match on ip_address)
    const { data: existing } = await supabaseAdmin
      .from('excluded_ips')
      .select('id')
      .eq('publication_id', publication_id)
      .eq('ip_address', parsed.ip)
      .maybeSingle()

    if (existing) {
      const displayName = parsed.isRange ? `${parsed.ip}/${parsed.prefix}` : parsed.ip
      return NextResponse.json({
        success: true,
        message: `IP "${displayName}" is already excluded`
      })
    }

    // Insert new exclusion
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('excluded_ips')
      .insert({
        publication_id,
        ip_address: parsed.ip,
        is_range: parsed.isRange,
        cidr_prefix: parsed.prefix,
        reason: reason || null,
        added_by: session.user.email
      })
      .select()
      .single()

    if (insertError) {
      console.error('[IP Exclusion] Error adding excluded IP:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const displayName = parsed.isRange ? `${parsed.ip}/${parsed.prefix}` : parsed.ip
    console.log(`[IP Exclusion] Added: ${displayName} (reason: ${reason || 'none'})`)

    // Return updated list - use explicit limit to avoid Supabase's 1000 row default
    const { data: excludedIps } = await supabaseAdmin
      .from('excluded_ips')
      .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
      .eq('publication_id', publication_id)
      .order('created_at', { ascending: false })
      .limit(10000)

    return NextResponse.json({
      success: true,
      message: `"${displayName}" excluded from analytics`,
      added: inserted,
      ips: excludedIps || []
    })

  } catch (error) {
    console.error('[IP Exclusion] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove an IP from the exclusion list
 * Body: { publication_id, ip_address }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // For deletion, we match on the stored ip_address (without prefix)
    // The UI should send just the IP part
    const normalizedIP = ip_address.trim().split('/')[0]

    // Delete the exclusion
    const { error: deleteError } = await supabaseAdmin
      .from('excluded_ips')
      .delete()
      .eq('publication_id', publication_id)
      .eq('ip_address', normalizedIP)

    if (deleteError) {
      console.error('[IP Exclusion] Error removing excluded IP:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log(`[IP Exclusion] Removed: ${normalizedIP}`)

    // Return updated list - use explicit limit to avoid Supabase's 1000 row default
    const { data: excludedIps } = await supabaseAdmin
      .from('excluded_ips')
      .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
      .eq('publication_id', publication_id)
      .order('created_at', { ascending: false })
      .limit(10000)

    return NextResponse.json({
      success: true,
      message: `IP "${normalizedIP}" removed from exclusion list`,
      ips: excludedIps || []
    })

  } catch (error) {
    console.error('[IP Exclusion] DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
