import { describe, it, expect } from 'vitest'
import { Deduplicator } from '../deduplicator'

// Access private methods via (instance as any) — standard pattern for testing
// pure algorithmic methods without refactoring the class.
function createDedup(config?: Partial<{ strictnessThreshold: number; historicalLookbackDays: number }>) {
  return new Deduplicator(config)
}

// Minimal RssPost-like shape for hash/title methods
function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 'post-1',
    title: 'Test Title',
    content: null,
    description: null,
    full_article_text: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------
describe('Deduplicator constructor', () => {
  it('uses default config when none provided', () => {
    const dedup = createDedup()
    expect((dedup as any).config.strictnessThreshold).toBe(0.80)
    expect((dedup as any).config.historicalLookbackDays).toBe(3)
  })

  it('accepts custom config overrides', () => {
    const dedup = createDedup({ strictnessThreshold: 0.9, historicalLookbackDays: 7 })
    expect((dedup as any).config.strictnessThreshold).toBe(0.9)
    expect((dedup as any).config.historicalLookbackDays).toBe(7)
  })

  it('partially overrides config', () => {
    const dedup = createDedup({ strictnessThreshold: 0.5 })
    expect((dedup as any).config.strictnessThreshold).toBe(0.5)
    expect((dedup as any).config.historicalLookbackDays).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// createContentHash
// ---------------------------------------------------------------------------
describe('createContentHash', () => {
  it('produces same hash for identical content', () => {
    const dedup = createDedup()
    const post = makePost({ full_article_text: 'Hello world' })
    const hash1 = (dedup as any).createContentHash(post)
    const hash2 = (dedup as any).createContentHash(post)
    expect(hash1).toBe(hash2)
  })

  it('produces different hash for different content', () => {
    const dedup = createDedup()
    const hash1 = (dedup as any).createContentHash(makePost({ full_article_text: 'Hello' }))
    const hash2 = (dedup as any).createContentHash(makePost({ full_article_text: 'World' }))
    expect(hash1).not.toBe(hash2)
  })

  it('normalizes whitespace', () => {
    const dedup = createDedup()
    const hash1 = (dedup as any).createContentHash(makePost({ full_article_text: 'hello   world' }))
    const hash2 = (dedup as any).createContentHash(makePost({ full_article_text: 'hello world' }))
    expect(hash1).toBe(hash2)
  })

  it('prefers full_article_text over content', () => {
    const dedup = createDedup()
    const postA = makePost({ full_article_text: 'full text', content: 'content text' })
    const postB = makePost({ full_article_text: 'full text', content: 'different' })
    expect((dedup as any).createContentHash(postA)).toBe((dedup as any).createContentHash(postB))
  })

  it('falls back to content when full_article_text is empty', () => {
    const dedup = createDedup()
    const postA = makePost({ full_article_text: null, content: 'content text' })
    const postB = makePost({ full_article_text: null, content: 'content text' })
    expect((dedup as any).createContentHash(postA)).toBe((dedup as any).createContentHash(postB))
  })

  it('falls back to description when content is empty', () => {
    const dedup = createDedup()
    const post = makePost({ full_article_text: null, content: null, description: 'desc text' })
    const hash = (dedup as any).createContentHash(post)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('falls back to title when all content fields are empty', () => {
    const dedup = createDedup()
    const post = makePost({ title: 'My Title', full_article_text: null, content: null, description: null })
    const hash = (dedup as any).createContentHash(post)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('is case-insensitive', () => {
    const dedup = createDedup()
    const hash1 = (dedup as any).createContentHash(makePost({ full_article_text: 'Hello World' }))
    const hash2 = (dedup as any).createContentHash(makePost({ full_article_text: 'hello world' }))
    expect(hash1).toBe(hash2)
  })
})

// ---------------------------------------------------------------------------
// normalizeTitle
// ---------------------------------------------------------------------------
describe('normalizeTitle', () => {
  it('lowercases text', () => {
    const dedup = createDedup()
    expect((dedup as any).normalizeTitle('HELLO')).toBe('hello')
  })

  it('removes punctuation', () => {
    const dedup = createDedup()
    expect((dedup as any).normalizeTitle("It's a test!")).toBe('its a test')
  })

  it('collapses whitespace', () => {
    const dedup = createDedup()
    expect((dedup as any).normalizeTitle('hello   world')).toBe('hello world')
  })

  it('trims leading/trailing whitespace', () => {
    const dedup = createDedup()
    expect((dedup as any).normalizeTitle('  hello  ')).toBe('hello')
  })

  it('handles combined normalization', () => {
    const dedup = createDedup()
    expect((dedup as any).normalizeTitle('  AI is GREAT!!  ')).toBe('ai is great')
  })
})

// ---------------------------------------------------------------------------
// calculateJaccardSimilarity
// ---------------------------------------------------------------------------
describe('calculateJaccardSimilarity', () => {
  it('returns 1.0 for identical titles', () => {
    const dedup = createDedup()
    expect((dedup as any).calculateJaccardSimilarity('hello world', 'hello world')).toBe(1.0)
  })

  it('returns 0.0 for completely different titles', () => {
    const dedup = createDedup()
    expect((dedup as any).calculateJaccardSimilarity('hello world', 'foo bar')).toBe(0.0)
  })

  it('returns expected ratio for partial overlap', () => {
    const dedup = createDedup()
    // "hello world" words: {hello, world}
    // "hello there" words: {hello, there}
    // intersection: {hello} = 1
    // union: {hello, world, there} = 3
    // Jaccard = 1/3
    const result = (dedup as any).calculateJaccardSimilarity('hello world', 'hello there')
    expect(result).toBeCloseTo(1 / 3, 5)
  })

  it('returns 1.0 when both strings are empty', () => {
    const dedup = createDedup()
    expect((dedup as any).calculateJaccardSimilarity('', '')).toBe(1.0)
  })

  it('returns 0.0 when one string is empty', () => {
    const dedup = createDedup()
    expect((dedup as any).calculateJaccardSimilarity('hello', '')).toBe(0.0)
    expect((dedup as any).calculateJaccardSimilarity('', 'hello')).toBe(0.0)
  })

  it('ignores duplicate words within a title', () => {
    const dedup = createDedup()
    // "hello hello" → Set{hello}, "hello world" → Set{hello, world}
    // intersection = 1, union = 2 → 0.5
    const result = (dedup as any).calculateJaccardSimilarity('hello hello', 'hello world')
    expect(result).toBe(0.5)
  })
})
