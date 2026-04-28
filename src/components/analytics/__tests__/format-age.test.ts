import { describe, it, expect } from 'vitest'
import { formatAge } from '../format-age'

describe('formatAge', () => {
  it('returns "just now" for ages under 60 seconds', () => {
    expect(formatAge(0)).toBe('just now')
    expect(formatAge(30 * 1000)).toBe('just now')
    expect(formatAge(59 * 1000)).toBe('just now')
  })

  it('returns minutes for ages 1m to 59m', () => {
    expect(formatAge(60 * 1000)).toBe('1m ago')
    expect(formatAge(15 * 60 * 1000)).toBe('15m ago')
    expect(formatAge(59 * 60 * 1000)).toBe('59m ago')
  })

  it('returns hours for ages 1h to 23h', () => {
    expect(formatAge(60 * 60 * 1000)).toBe('1h ago')
    expect(formatAge(12 * 60 * 60 * 1000)).toBe('12h ago')
    expect(formatAge(23 * 60 * 60 * 1000)).toBe('23h ago')
  })

  it('returns days for ages 24h and beyond', () => {
    expect(formatAge(24 * 60 * 60 * 1000)).toBe('1d ago')
    expect(formatAge(3 * 24 * 60 * 60 * 1000)).toBe('3d ago')
    expect(formatAge(30 * 24 * 60 * 60 * 1000)).toBe('30d ago')
  })

  it('handles negative ages (clock skew) by treating as just now', () => {
    expect(formatAge(-1000)).toBe('just now')
  })
})
