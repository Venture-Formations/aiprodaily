/**
 * Honeypot Click Handler
 * Auto-excludes IPs that click the hidden honeypot link
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * Handles a honeypot link click by auto-excluding the IP address
 *
 * Honeypot links are invisible to humans (hidden via CSS), so any click
 * is definitively from a bot. This provides zero false positives.
 *
 * This function is designed to be fire-and-forget - it logs errors but doesn't throw.
 *
 * @param ipAddress - The IP address that clicked the honeypot
 * @param publicationId - The publication ID for multi-tenant isolation
 */
export async function handleHoneypotClick(
  ipAddress: string,
  publicationId: string
): Promise<void> {
  try {
    // Check if already excluded
    const { data: existing } = await supabaseAdmin
      .from('excluded_ips')
      .select('id')
      .eq('publication_id', publicationId)
      .eq('ip_address', ipAddress)
      .maybeSingle()

    if (existing) {
      // Already excluded, no need to add again
      console.log(`[Honeypot] IP ${ipAddress} already excluded`)
      return
    }

    // Auto-exclude the IP
    const { error: insertError } = await supabaseAdmin
      .from('excluded_ips')
      .insert({
        publication_id: publicationId,
        ip_address: ipAddress,
        is_range: false,
        cidr_prefix: null,
        reason: 'Honeypot click detected',
        added_by: 'system:honeypot',
        exclusion_source: 'honeypot'
      })

    if (insertError) {
      console.error('[Honeypot] Insert error:', insertError.message)
      return
    }

    console.log(`[Honeypot] Auto-excluded IP ${ipAddress}`)
  } catch (error) {
    console.error('[Honeypot] Unexpected error:', error instanceof Error ? error.message : error)
  }
}
