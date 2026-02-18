import { describe, it, expect } from 'vitest'
import { AppSelector } from '../app-selector'
import type { AIApplication } from '@/types/database'

function makeApp(overrides: Partial<AIApplication> = {}): AIApplication {
  return {
    id: crypto.randomUUID(),
    app_name: 'Test App',
    category: 'Productivity' as const,
    is_affiliate: false,
    is_active: true,
    is_featured: false,
    last_used_date: null,
    publication_id: 'test',
    ...overrides,
  } as AIApplication
}

describe('AppSelector.isInCooldown', () => {
  it('returns false for non-affiliate apps', () => {
    const app = makeApp({ is_affiliate: false, last_used_date: new Date().toISOString() })
    expect(AppSelector.isInCooldown(app, 7)).toBe(false)
  })

  it('returns false when app has never been used', () => {
    const app = makeApp({ is_affiliate: true, last_used_date: null })
    expect(AppSelector.isInCooldown(app, 7)).toBe(false)
  })

  it('returns true when affiliate was used within cooldown window', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const app = makeApp({ is_affiliate: true, last_used_date: yesterday.toISOString() })
    expect(AppSelector.isInCooldown(app, 7)).toBe(true)
  })

  it('returns false when affiliate was used outside cooldown window', () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const app = makeApp({ is_affiliate: true, last_used_date: tenDaysAgo.toISOString() })
    expect(AppSelector.isInCooldown(app, 7)).toBe(false)
  })
})

describe('AppSelector.getCategoryCounts', () => {
  it('returns empty map for no apps', () => {
    const counts = AppSelector.getCategoryCounts([])
    expect(counts.size).toBe(0)
  })

  it('counts categories correctly', () => {
    const apps = [
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Tax & Compliance' }),
    ]
    const counts = AppSelector.getCategoryCounts(apps)
    expect(counts.get('Productivity')).toBe(2)
    expect(counts.get('Tax & Compliance')).toBe(1)
  })

  it('handles apps with no category as Unknown', () => {
    const apps = [makeApp({ category: null })]
    const counts = AppSelector.getCategoryCounts(apps)
    expect(counts.get('Unknown')).toBe(1)
  })
})

describe('AppSelector.wouldExceedCategoryMax', () => {
  it('returns false when category has room', () => {
    const existing = [makeApp({ category: 'Productivity' })]
    const candidate = makeApp({ category: 'Productivity' })
    expect(AppSelector.wouldExceedCategoryMax(candidate, existing, 3)).toBe(false)
  })

  it('returns true when category is at max', () => {
    const existing = [
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Productivity' }),
    ]
    const candidate = makeApp({ category: 'Productivity' })
    expect(AppSelector.wouldExceedCategoryMax(candidate, existing, 3)).toBe(true)
  })

  it('allows different categories', () => {
    const existing = [
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Productivity' }),
      makeApp({ category: 'Productivity' }),
    ]
    const candidate = makeApp({ category: 'Tax & Compliance' })
    expect(AppSelector.wouldExceedCategoryMax(candidate, existing, 3)).toBe(false)
  })
})
