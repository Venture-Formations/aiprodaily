// src/lib/newsletter-templates/__tests__/helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  getLightBackground,
  formatEventDate,
  formatEventTime,
  getEventEmoji,
  getArticleEmoji,
  getBreakingNewsEmoji,
  getAIAppEmoji,
} from '../helpers'

describe('getLightBackground', () => {
  it('blends a hex color with white at 90:10 (white-heavy)', () => {
    // Pure black (#000000) blended 10% with 90% white → rgb(230, 230, 230)
    expect(getLightBackground('#000000')).toBe('rgb(230, 230, 230)')
  })

  it('handles hex without leading #', () => {
    expect(getLightBackground('FFFFFF')).toBe('rgb(255, 255, 255)')
  })

  it('produces a tinted (not full) version of a saturated color', () => {
    // #FF0000 (red) → 10% red + 90% white → rgb(255, 230, 230)
    expect(getLightBackground('#FF0000')).toBe('rgb(255, 230, 230)')
  })
})

describe('formatEventDate', () => {
  it('parses YYYY-MM-DD as a local date (no UTC drift)', () => {
    // Critical: this MUST use local parsing, not new Date(str).
    // 2026-01-01 should ALWAYS render as Jan 1 regardless of host timezone.
    expect(formatEventDate('2026-01-01')).toBe('Thursday, January 1')
  })

  it('formats mid-year date', () => {
    expect(formatEventDate('2026-07-04')).toBe('Saturday, July 4')
  })
})

describe('formatEventTime', () => {
  it('formats whole-hour times without minutes', () => {
    const start = '2026-04-29T14:00:00'
    const end = '2026-04-29T17:00:00'
    expect(formatEventTime(start, end)).toBe('2PM - 5PM')
  })

  it('includes minutes when non-zero', () => {
    const start = '2026-04-29T09:30:00'
    const end = '2026-04-29T11:00:00'
    expect(formatEventTime(start, end)).toBe('9:30AM - 11AM')
  })

  it('handles midnight (12AM) and noon (12PM)', () => {
    expect(formatEventTime('2026-04-29T00:00:00', '2026-04-29T12:00:00')).toBe('12AM - 12PM')
  })
})

describe('getEventEmoji', () => {
  it('matches a category keyword', () => {
    expect(getEventEmoji('Saturday Yoga in the Park', '')).toBe('🧘')
  })

  it('returns party emoji default when no keywords match', () => {
    expect(getEventEmoji('Random Untagged Event', '')).toBe('🎉')
  })

  it('checks venue text in addition to title', () => {
    // Empty title with amphitheater venue should match music
    expect(getEventEmoji('Outdoor Show', 'Riverside Amphitheater')).toBe('🎶')
  })
})

describe('getArticleEmoji', () => {
  it('matches AI/automation as 🤖', () => {
    expect(getArticleEmoji('New AI tool released', '')).toBe('🤖')
  })

  it('matches tax content as 💰', () => {
    expect(getArticleEmoji('Year-end tax planning', '')).toBe('💰')
  })

  it('returns default 📈 when nothing matches', () => {
    expect(getArticleEmoji('Generic announcement', 'No keywords here')).toBe('📈')
  })
})

describe('getBreakingNewsEmoji', () => {
  it('returns default 🔴 when nothing matches', () => {
    expect(getBreakingNewsEmoji('Something happened', 'somewhere')).toBe('🔴')
  })

  it('matches fraud/scandal as ⚠️', () => {
    expect(getBreakingNewsEmoji('Major fraud uncovered', '')).toBe('⚠️')
  })
})

describe('getAIAppEmoji', () => {
  it('matches accounting category', () => {
    expect(getAIAppEmoji('AppName', 'Accounting', 'desc')).toBe('📊')
  })

  it('returns default 🔧 when nothing matches', () => {
    expect(getAIAppEmoji('AppName', 'OtherCategory', 'desc')).toBe('🔧')
  })
})
