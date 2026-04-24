/**
 * Bot and IP filter policy for click analytics.
 *
 * Single source of truth for "should this click count?".
 * Called by every DAL read that returns link_clicks aggregates.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import type { LinkClickRow, ExcludedIpRow } from './types'

const log = createLogger({ module: 'analytics:bot-policy' })

/**
 * In-memory index of a publication's excluded IPs.
 * Supports exact-match lookup (has) and CIDR-range match (matchesCidr).
 * Case-insensitive; handles null lookups.
 */
export class ExcludedIpSet {
  private readonly exactIps: Set<string>
  private readonly ranges: Array<{ cidr: string; prefix: number }>

  constructor(rows: ExcludedIpRow[]) {
    this.exactIps = new Set()
    this.ranges = []
    for (const row of rows) {
      if (row.is_range && row.cidr_prefix !== null) {
        this.ranges.push({ cidr: row.ip_address, prefix: row.cidr_prefix })
      } else {
        this.exactIps.add(row.ip_address.toLowerCase())
      }
    }
  }

  has(ip: string | null): boolean {
    if (!ip) return false
    return this.exactIps.has(ip.toLowerCase())
  }

  matchesCidr(ip: string | null): boolean {
    if (!ip) return false
    for (const range of this.ranges) {
      if (ipInCidr(ip, range.cidr, range.prefix)) return true
    }
    return false
  }
}

/** Pure function — does a click count toward metrics? */
export function isClickCountable(
  row: Pick<LinkClickRow, 'is_bot_ua' | 'ip_address'>,
  excludedIps: ExcludedIpSet
): boolean {
  if (row.is_bot_ua === true) return false
  if (excludedIps.has(row.ip_address)) return false
  if (excludedIps.matchesCidr(row.ip_address)) return false
  return true
}

/** Load excluded IPs for a publication. Returns empty set on error. */
export async function loadExcludedIps(publicationId: string): Promise<ExcludedIpSet> {
  const { data, error } = await supabaseAdmin
    .from('excluded_ips')
    .select('ip_address, is_range, cidr_prefix')
    .eq('publication_id', publicationId)

  if (error || !data) {
    log.error({ err: error, publicationId }, 'Failed to load excluded_ips')
    return new ExcludedIpSet([])
  }
  return new ExcludedIpSet(data as ExcludedIpRow[])
}

// ---------------------------------------------------------------------------
// CIDR helpers (IPv4 only; IPv6 CIDR not currently used by excluded_ips)
// ---------------------------------------------------------------------------

function ipInCidr(ip: string, cidr: string, prefix: number): boolean {
  if (ip.includes(':') || cidr.includes(':')) {
    return false // IPv6 not supported for CIDR match
  }
  const ipInt = ipv4ToInt(ip)
  const cidrInt = ipv4ToInt(cidr)
  if (ipInt === null || cidrInt === null) return false
  if (prefix < 0 || prefix > 32) return false
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipInt & mask) === (cidrInt & mask)
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    out = (out << 8) | n
  }
  return out >>> 0
}
