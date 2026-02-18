import { describe, it, expect } from 'vitest'
import { checkUserAgent } from '../ua-detector'

describe('checkUserAgent', () => {
  it('flags empty user agent as bot', () => {
    expect(checkUserAgent('')).toEqual({ isBot: true, reason: 'Empty user agent' })
    expect(checkUserAgent(null)).toEqual({ isBot: true, reason: 'Empty user agent' })
    expect(checkUserAgent(undefined)).toEqual({ isBot: true, reason: 'Empty user agent' })
  })

  it('flags known bot patterns', () => {
    const bots = [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'python-requests/2.28.0',
      'curl/7.88.1',
      'Mozilla/5.0 (compatible; Bingbot/2.0)',
      'Barracuda/5.0',
      'HeadlessChrome/120.0',
    ]
    for (const ua of bots) {
      const result = checkUserAgent(ua)
      expect(result.isBot, `Expected "${ua}" to be flagged as bot`).toBe(true)
      expect(result.reason).toBeTruthy()
    }
  })

  it('allows legitimate browser user agents', () => {
    const browsers = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    ]
    for (const ua of browsers) {
      const result = checkUserAgent(ua)
      expect(result.isBot, `Expected "${ua}" to pass as legitimate`).toBe(false)
      expect(result.reason).toBeNull()
    }
  })

  it('is case-insensitive', () => {
    expect(checkUserAgent('GOOGLEBOT').isBot).toBe(true)
    expect(checkUserAgent('Python-Requests/2.0').isBot).toBe(true)
  })
})
