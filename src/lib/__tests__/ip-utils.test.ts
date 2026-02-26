import { describe, it, expect } from 'vitest'
import {
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  parseCIDR,
  isValidCIDR,
  ipMatchesCIDR,
  isIPExcluded,
  formatExclusion,
  parseIPInput,
  type IPExclusion,
} from '../ip-utils'

// ---------------------------------------------------------------------------
// isValidIPv4
// ---------------------------------------------------------------------------
describe('isValidIPv4', () => {
  it('accepts standard IPv4', () => {
    expect(isValidIPv4('192.168.1.1')).toBe(true)
  })

  it('accepts all-zero address', () => {
    expect(isValidIPv4('0.0.0.0')).toBe(true)
  })

  it('accepts broadcast address', () => {
    expect(isValidIPv4('255.255.255.255')).toBe(true)
  })

  it('rejects octet > 255', () => {
    expect(isValidIPv4('256.1.1.1')).toBe(false)
  })

  it('rejects too few octets', () => {
    expect(isValidIPv4('192.168.1')).toBe(false)
  })

  it('rejects too many octets', () => {
    expect(isValidIPv4('192.168.1.1.1')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidIPv4('')).toBe(false)
  })

  it('rejects alphabetic characters', () => {
    expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false)
  })

  it('rejects negative numbers', () => {
    expect(isValidIPv4('-1.0.0.0')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isValidIPv6
// ---------------------------------------------------------------------------
describe('isValidIPv6', () => {
  it('accepts full IPv6 address', () => {
    expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
  })

  it('accepts abbreviated IPv6 with ::', () => {
    expect(isValidIPv6('::1')).toBe(true)
  })

  it('accepts all-zero shorthand', () => {
    expect(isValidIPv6('::')).toBe(true)
  })

  it('rejects plain IPv4', () => {
    expect(isValidIPv6('192.168.1.1')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidIPv6('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isValidIP
// ---------------------------------------------------------------------------
describe('isValidIP', () => {
  it('accepts IPv4', () => {
    expect(isValidIP('10.0.0.1')).toBe(true)
  })

  it('accepts IPv6', () => {
    expect(isValidIP('::1')).toBe(true)
  })

  it('rejects garbage', () => {
    expect(isValidIP('not-an-ip')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseCIDR
// ---------------------------------------------------------------------------
describe('parseCIDR', () => {
  it('parses valid IPv4 CIDR', () => {
    expect(parseCIDR('192.168.1.0/24')).toEqual({ ip: '192.168.1.0', prefix: 24 })
  })

  it('parses /0 prefix', () => {
    expect(parseCIDR('0.0.0.0/0')).toEqual({ ip: '0.0.0.0', prefix: 0 })
  })

  it('parses /32 prefix', () => {
    expect(parseCIDR('10.0.0.1/32')).toEqual({ ip: '10.0.0.1', prefix: 32 })
  })

  it('parses valid IPv6 CIDR', () => {
    expect(parseCIDR('2001:db8::/32')).toEqual({ ip: '2001:db8::', prefix: 32 })
  })

  it('rejects prefix > 32 for IPv4', () => {
    expect(parseCIDR('10.0.0.0/33')).toBeNull()
  })

  it('rejects prefix > 128 for IPv6', () => {
    expect(parseCIDR('::1/129')).toBeNull()
  })

  it('rejects negative prefix', () => {
    expect(parseCIDR('10.0.0.0/-1')).toBeNull()
  })

  it('rejects missing prefix', () => {
    expect(parseCIDR('10.0.0.0')).toBeNull()
  })

  it('rejects non-numeric prefix', () => {
    expect(parseCIDR('10.0.0.0/abc')).toBeNull()
  })

  it('rejects invalid IP in CIDR', () => {
    expect(parseCIDR('999.999.999.999/24')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isValidCIDR
// ---------------------------------------------------------------------------
describe('isValidCIDR', () => {
  it('returns true for valid CIDR', () => {
    expect(isValidCIDR('192.168.0.0/16')).toBe(true)
  })

  it('returns false for plain IP', () => {
    expect(isValidCIDR('192.168.1.1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ipMatchesCIDR
// ---------------------------------------------------------------------------
describe('ipMatchesCIDR', () => {
  it('matches IPv4 within /24 range', () => {
    expect(ipMatchesCIDR('192.168.1.100', '192.168.1.0', 24)).toBe(true)
  })

  it('does not match IPv4 outside /24 range', () => {
    expect(ipMatchesCIDR('192.168.2.1', '192.168.1.0', 24)).toBe(false)
  })

  it('/32 matches exact IP only', () => {
    expect(ipMatchesCIDR('10.0.0.1', '10.0.0.1', 32)).toBe(true)
    expect(ipMatchesCIDR('10.0.0.2', '10.0.0.1', 32)).toBe(false)
  })

  it('/0 matches all IPv4', () => {
    expect(ipMatchesCIDR('1.2.3.4', '0.0.0.0', 0)).toBe(true)
    expect(ipMatchesCIDR('255.255.255.255', '0.0.0.0', 0)).toBe(true)
  })

  it('matches IPv6 within range', () => {
    expect(ipMatchesCIDR('2001:db8::1', '2001:db8::', 32)).toBe(true)
  })

  it('does not match IPv6 outside range', () => {
    expect(ipMatchesCIDR('2001:db9::1', '2001:db8::', 32)).toBe(false)
  })

  it('returns false for mixed IP versions', () => {
    expect(ipMatchesCIDR('192.168.1.1', '::1', 32)).toBe(false)
    expect(ipMatchesCIDR('::1', '192.168.1.0', 24)).toBe(false)
  })

  it('matches /16 range correctly', () => {
    expect(ipMatchesCIDR('10.1.255.255', '10.1.0.0', 16)).toBe(true)
    expect(ipMatchesCIDR('10.2.0.0', '10.1.0.0', 16)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isIPExcluded
// ---------------------------------------------------------------------------
describe('isIPExcluded', () => {
  const exclusions: IPExclusion[] = [
    { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
    { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 },
  ]

  it('matches exact IP exclusion', () => {
    expect(isIPExcluded('1.2.3.4', exclusions)).toBe(true)
  })

  it('matches CIDR range exclusion', () => {
    expect(isIPExcluded('10.255.255.255', exclusions)).toBe(true)
  })

  it('returns false for non-excluded IP', () => {
    expect(isIPExcluded('8.8.8.8', exclusions)).toBe(false)
  })

  it('returns false for null IP', () => {
    expect(isIPExcluded(null, exclusions)).toBe(false)
  })

  it('returns false for empty exclusion list', () => {
    expect(isIPExcluded('1.2.3.4', [])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatExclusion
// ---------------------------------------------------------------------------
describe('formatExclusion', () => {
  it('formats a range as CIDR', () => {
    expect(
      formatExclusion({ ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 })
    ).toBe('10.0.0.0/8')
  })

  it('formats a single IP without prefix', () => {
    expect(
      formatExclusion({ ip_address: '1.2.3.4', is_range: false, cidr_prefix: null })
    ).toBe('1.2.3.4')
  })
})

// ---------------------------------------------------------------------------
// parseIPInput
// ---------------------------------------------------------------------------
describe('parseIPInput', () => {
  it('parses single IPv4', () => {
    expect(parseIPInput('192.168.1.1')).toEqual({
      ip: '192.168.1.1',
      isRange: false,
      prefix: null,
    })
  })

  it('parses CIDR input', () => {
    expect(parseIPInput('10.0.0.0/8')).toEqual({
      ip: '10.0.0.0',
      isRange: true,
      prefix: 8,
    })
  })

  it('trims whitespace', () => {
    expect(parseIPInput('  10.0.0.1  ')).toEqual({
      ip: '10.0.0.1',
      isRange: false,
      prefix: null,
    })
  })

  it('returns null for invalid input', () => {
    expect(parseIPInput('not-an-ip')).toBeNull()
  })

  it('returns null for invalid CIDR', () => {
    expect(parseIPInput('10.0.0.0/33')).toBeNull()
  })
})
