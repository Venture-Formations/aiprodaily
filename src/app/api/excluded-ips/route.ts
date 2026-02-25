import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseIPInput } from '@/lib/ip-utils'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Unified IP Exclusion API
 * Manages excluded IPs for filtering poll responses and link click analytics
 * Supports both single IPs and CIDR ranges
 */

/**
 * GET - Fetch all excluded IPs for a publication
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'excluded-ips' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Fetch all excluded IPs using pagination (Supabase limits to 1000 per query)
    const BATCH_SIZE = 1000
    let allExcludedIps: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('excluded_ips')
        .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at, exclusion_source')
        .eq('publication_id', publicationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('[IP Exclusion] Error fetching excluded IPs:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (batch && batch.length > 0) {
        allExcludedIps = allExcludedIps.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    return NextResponse.json({
      success: true,
      ips: allExcludedIps
    })
  }
)

/**
 * POST - Add an IP or CIDR range to the exclusion list
 * Body: { publication_id, ip_address, reason? }
 * ip_address can be a single IP (192.168.1.1) or CIDR range (192.168.1.0/24)
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'excluded-ips' },
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

    // Return updated list using pagination
    const BATCH_SIZE = 1000
    let allExcludedIps: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch } = await supabaseAdmin
        .from('excluded_ips')
        .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
        .eq('publication_id', publication_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1)

      if (batch && batch.length > 0) {
        allExcludedIps = allExcludedIps.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    return NextResponse.json({
      success: true,
      message: `"${displayName}" excluded from analytics`,
      added: inserted,
      ips: allExcludedIps
    })
  }
)

/**
 * DELETE - Remove IP(s) from the exclusion list
 * Body options:
 *   - { publication_id, ip_address } - Remove single IP
 *   - { publication_id, exclusion_source } - Remove all IPs with given source (velocity, honeypot, manual)
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'excluded-ips' },
  async ({ request }) => {
    const body = await request.json()
    const { publication_id, ip_address, exclusion_source } = body

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Bulk delete by exclusion_source
    if (exclusion_source && typeof exclusion_source === 'string') {
      const validSources = ['manual', 'velocity', 'honeypot']
      if (!validSources.includes(exclusion_source)) {
        return NextResponse.json(
          { error: `exclusion_source must be one of: ${validSources.join(', ')}` },
          { status: 400 }
        )
      }

      // Count before deletion
      const { count: beforeCount } = await supabaseAdmin
        .from('excluded_ips')
        .select('*', { count: 'exact', head: true })
        .eq('publication_id', publication_id)
        .eq('exclusion_source', exclusion_source)

      // Delete all with given source
      const { error: bulkDeleteError } = await supabaseAdmin
        .from('excluded_ips')
        .delete()
        .eq('publication_id', publication_id)
        .eq('exclusion_source', exclusion_source)

      if (bulkDeleteError) {
        console.error('[IP Exclusion] Error bulk removing excluded IPs:', bulkDeleteError)
        return NextResponse.json({ error: bulkDeleteError.message }, { status: 500 })
      }

      console.log(`[IP Exclusion] Bulk removed ${beforeCount || 0} IPs with source: ${exclusion_source}`)

      // Return updated list using pagination
      const BATCH_SIZE = 1000
      let allExcludedIps: any[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: batch } = await supabaseAdmin
          .from('excluded_ips')
          .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at, exclusion_source')
          .eq('publication_id', publication_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1)

        if (batch && batch.length > 0) {
          allExcludedIps = allExcludedIps.concat(batch)
          offset += BATCH_SIZE
          hasMore = batch.length === BATCH_SIZE
        } else {
          hasMore = false
        }
      }

      return NextResponse.json({
        success: true,
        message: `Removed ${beforeCount || 0} IPs with exclusion_source="${exclusion_source}"`,
        removed: beforeCount || 0,
        ips: allExcludedIps
      })
    }

    if (!ip_address || typeof ip_address !== 'string') {
      return NextResponse.json(
        { error: 'ip_address or exclusion_source is required' },
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

    // Return updated list using pagination
    const BATCH_SIZE = 1000
    let allExcludedIps: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch } = await supabaseAdmin
        .from('excluded_ips')
        .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
        .eq('publication_id', publication_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1)

      if (batch && batch.length > 0) {
        allExcludedIps = allExcludedIps.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    return NextResponse.json({
      success: true,
      message: `IP "${normalizedIP}" removed from exclusion list`,
      ips: allExcludedIps
    })
  }
)
