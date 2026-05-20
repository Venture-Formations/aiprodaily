import { describe, it, expect } from 'vitest'
import { selectPostsWithTickerCooldown } from '../ticker-cooldown'

const post = (id: string, ticker: string | null) => ({ id, ticker })

describe('selectPostsWithTickerCooldown', () => {
  it('with an empty cooldown set, behaves like one-per-ticker dedup', () => {
    const posts = [post('a', 'AAA'), post('b', 'AAA'), post('c', 'BBB')]
    const r = selectPostsWithTickerCooldown(posts, new Set<string>(), 3, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'c'])
    expect(r.skippedByCooldown).toBe(0)
    expect(r.backfilled).toBe(0)
  })

  it('skips a ticker that is on cooldown', () => {
    // articlesNeeded=2 and two non-cooldown posts exist, so no backfill.
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'MKL')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'c'])
    expect(r.skippedByCooldown).toBe(1)
    expect(r.backfilled).toBe(0)
  })

  it('matches cooldown tickers case-insensitively', () => {
    // articlesNeeded=1 and one non-cooldown post exists, so no backfill.
    const posts = [post('a', 'cor'), post('b', 'IBM')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 1, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b'])
  })

  it('backfills cooled-down posts when the primary pass is short of the minimum', () => {
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'a'])
    expect(r.skippedByCooldown).toBe(2)
    expect(r.backfilled).toBe(1)
  })

  it('does not backfill when the primary pass already meets the minimum', () => {
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'MKL')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'c'])
    expect(r.backfilled).toBe(0)
  })

  it('never selects two posts for the same ticker, even via backfill', () => {
    const posts = [post('a', 'COR'), post('b', 'COR'), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 3, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a'])
    expect(r.backfilled).toBe(1)
  })

  it('passes through posts with no ticker without deduping them', () => {
    const posts = [post('a', null), post('b', null), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'b'])
    expect(r.skippedByCooldown).toBe(1)
  })

  it('caps the primary pass at postsToAssign', () => {
    const posts = [post('a', 'A'), post('b', 'B'), post('c', 'C'), post('d', 'D')]
    const r = selectPostsWithTickerCooldown(posts, new Set<string>(), 2, 3)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('honors articlesNeeded even when postsToAssign is set below it', () => {
    const posts = [post('a', 'A'), post('b', 'B'), post('c', 'C'), post('d', 'D')]
    const r = selectPostsWithTickerCooldown(posts, new Set<string>(), 3, 1)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })
})
