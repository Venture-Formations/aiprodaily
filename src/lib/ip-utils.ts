/**
 * IP Address Utilities
 * Functions for validating, parsing, and matching IP addresses and CIDR ranges
 */

/**
 * Validate an IPv4 address
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Pattern.test(ip)) return false

  const octets = ip.split('.').map(Number)
  return octets.every(octet => octet >= 0 && octet <= 255)
}

/**
 * Validate an IPv6 address (simplified pattern)
 */
export function isValidIPv6(ip: string): boolean {
  // Basic IPv6 validation - handles most common formats
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  return ipv6Pattern.test(ip)
}

/**
 * Validate an IP address (IPv4 or IPv6)
 */
export function isValidIP(ip: string): boolean {
  return isValidIPv4(ip) || isValidIPv6(ip)
}

/**
 * Parse CIDR notation (e.g., "192.168.1.0/24")
 * Returns { ip: string, prefix: number } or null if invalid
 */
export function parseCIDR(input: string): { ip: string; prefix: number } | null {
  const parts = input.split('/')
  if (parts.length !== 2) return null

  const [ip, prefixStr] = parts
  const prefix = parseInt(prefixStr, 10)

  if (isNaN(prefix)) return null

  // Validate IP and prefix range
  if (isValidIPv4(ip)) {
    if (prefix < 0 || prefix > 32) return null
    return { ip, prefix }
  }

  if (isValidIPv6(ip)) {
    if (prefix < 0 || prefix > 128) return null
    return { ip, prefix }
  }

  return null
}

/**
 * Validate CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  return parseCIDR(cidr) !== null
}

/**
 * Convert IPv4 address to 32-bit integer
 */
function ipv4ToInt(ip: string): number {
  const octets = ip.split('.').map(Number)
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

/**
 * Create a 32-bit subnet mask from prefix length
 */
function createIPv4Mask(prefix: number): number {
  if (prefix === 0) return 0
  return (~0 << (32 - prefix)) >>> 0
}

/**
 * Check if an IPv4 address falls within a CIDR range
 */
function ipv4MatchesCIDR(ip: string, cidrIp: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip)
  const cidrInt = ipv4ToInt(cidrIp)
  const mask = createIPv4Mask(prefix)

  return (ipInt & mask) === (cidrInt & mask)
}

/**
 * Expand IPv6 address to full form (8 groups of 4 hex digits)
 */
function expandIPv6(ip: string): string[] | null {
  // Handle :: expansion
  const parts = ip.split('::')

  if (parts.length > 2) return null // Invalid - multiple ::

  let groups: string[] = []

  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []
    const missing = 8 - left.length - right.length

    if (missing < 0) return null

    groups = [...left, ...Array(missing).fill('0'), ...right]
  } else {
    groups = ip.split(':')
  }

  if (groups.length !== 8) return null

  // Pad each group to 4 hex digits
  return groups.map(g => g.padStart(4, '0'))
}

/**
 * Convert IPv6 address to array of 16-bit integers
 */
function ipv6ToInts(ip: string): number[] | null {
  const groups = expandIPv6(ip)
  if (!groups) return null

  return groups.map(g => parseInt(g, 16))
}

/**
 * Check if an IPv6 address falls within a CIDR range
 */
function ipv6MatchesCIDR(ip: string, cidrIp: string, prefix: number): boolean {
  const ipInts = ipv6ToInts(ip)
  const cidrInts = ipv6ToInts(cidrIp)

  if (!ipInts || !cidrInts) return false

  // Compare bit by bit up to prefix length
  let remainingBits = prefix

  for (let i = 0; i < 8 && remainingBits > 0; i++) {
    const bitsToCheck = Math.min(16, remainingBits)
    const mask = bitsToCheck === 16 ? 0xFFFF : (~0 << (16 - bitsToCheck)) & 0xFFFF

    if ((ipInts[i] & mask) !== (cidrInts[i] & mask)) {
      return false
    }

    remainingBits -= 16
  }

  return true
}

/**
 * Check if an IP address matches a CIDR range
 */
export function ipMatchesCIDR(ip: string, cidrIp: string, prefix: number): boolean {
  // Both must be same IP version
  const ipIsV4 = isValidIPv4(ip)
  const cidrIsV4 = isValidIPv4(cidrIp)

  if (ipIsV4 !== cidrIsV4) return false

  if (ipIsV4) {
    return ipv4MatchesCIDR(ip, cidrIp, prefix)
  }

  return ipv6MatchesCIDR(ip, cidrIp, prefix)
}

/**
 * Exclusion entry type
 */
export interface IPExclusion {
  ip_address: string
  is_range: boolean
  cidr_prefix: number | null
}

/**
 * Check if an IP address matches any exclusion in the list
 * Handles both single IPs and CIDR ranges
 */
export function isIPExcluded(ip: string | null, exclusions: IPExclusion[]): boolean {
  if (!ip) return false

  for (const exclusion of exclusions) {
    if (exclusion.is_range && exclusion.cidr_prefix !== null) {
      // CIDR range match
      if (ipMatchesCIDR(ip, exclusion.ip_address, exclusion.cidr_prefix)) {
        return true
      }
    } else {
      // Exact IP match
      if (ip === exclusion.ip_address) {
        return true
      }
    }
  }

  return false
}

/**
 * Format an exclusion for display
 * Returns "192.168.1.0/24" for ranges, "192.168.1.1" for single IPs
 */
export function formatExclusion(exclusion: IPExclusion): string {
  if (exclusion.is_range && exclusion.cidr_prefix !== null) {
    return `${exclusion.ip_address}/${exclusion.cidr_prefix}`
  }
  return exclusion.ip_address
}

/**
 * Parse user input that could be either a single IP or CIDR
 * Returns { ip, isRange, prefix } or null if invalid
 */
export function parseIPInput(input: string): { ip: string; isRange: boolean; prefix: number | null } | null {
  const trimmed = input.trim()

  // Check if it's CIDR notation
  if (trimmed.includes('/')) {
    const parsed = parseCIDR(trimmed)
    if (!parsed) return null
    return { ip: parsed.ip, isRange: true, prefix: parsed.prefix }
  }

  // Single IP
  if (!isValidIP(trimmed)) return null
  return { ip: trimmed, isRange: false, prefix: null }
}
