import { describe, it, expect } from 'vitest'
import { RSSProcessor } from '../rss-processor'

describe('RSSProcessor.detectAIRefusal', () => {
  it('returns null for valid article content', () => {
    const validContent = 'New AI tool streamlines accounting workflows for CPAs'
    expect(RSSProcessor.detectAIRefusal(validContent)).toBeNull()
  })

  it('detects "I\'m sorry" refusals', () => {
    const refusal = "I'm sorry, I need the actual article content to generate a summary."
    expect(RSSProcessor.detectAIRefusal(refusal)).toBe("i'm sorry")
  })

  it('detects "I cannot" refusals', () => {
    const refusal = 'I cannot generate content without access to the original article.'
    expect(RSSProcessor.detectAIRefusal(refusal)).toBe('i cannot')
  })

  it('detects "please provide" refusals', () => {
    const refusal = 'Please provide the article text so I can create a summary.'
    expect(RSSProcessor.detectAIRefusal(refusal)).toBe('please provide')
  })

  it('detects "without access to" refusals', () => {
    const refusal = 'Without access to the full article, it is not possible to summarize.'
    expect(RSSProcessor.detectAIRefusal(refusal)).toBe('without access to')
  })

  it('is case-insensitive', () => {
    expect(RSSProcessor.detectAIRefusal("I'M SORRY, I CANNOT")).toBe("i'm sorry")
  })

  it('handles empty string', () => {
    expect(RSSProcessor.detectAIRefusal('')).toBeNull()
  })

  it('does not false-positive on normal content containing partial matches', () => {
    // "provide" by itself should not trigger — only full phrases match
    const content = 'This tool will provide accountants with better insights'
    expect(RSSProcessor.detectAIRefusal(content)).toBeNull()
  })
})
