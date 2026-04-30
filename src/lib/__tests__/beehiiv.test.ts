import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getBeehiivSubscriberStats } from '../beehiiv'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('getBeehiivSubscriberStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed stats using actual Beehiiv field names (total_unique_opened, total_received)', async () => {
    // Mirrors a real production response shape (verified against Beehiiv API 2026-04-30).
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: 'sub_abc123',
          status: 'active',
          stats: {
            total_sent: 6,
            total_received: 6,
            total_unique_opened: 5,
            total_clicked: 3,
            total_unique_clicked: 2,
            open_rate: 83.33,
            click_rate: 40.0,
          },
        },
      },
    })

    const result = await getBeehiivSubscriberStats('user@example.com', 'pub_xyz', 'key123')

    expect(result.found).toBe(true)
    expect(result.status).toBe('active')
    expect(result.uniqueOpens).toBe(5)
    expect(result.emailsReceived).toBe(6)
    expect(result.subscriptionId).toBe('sub_abc123')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.beehiiv.com/v2/publications/pub_xyz/subscriptions/by_email/user%40example.com?expand=stats',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer key123' }) }),
    )
  })

  it('falls back to legacy unique_opens / emails_received field names', async () => {
    // Defensive: if Beehiiv ever returns the older field names we used to assume.
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: 'sub_abc123',
          status: 'active',
          stats: {
            emails_received: 10,
            unique_opens: 4,
          },
        },
      },
    })

    const result = await getBeehiivSubscriberStats('user@example.com', 'pub_xyz', 'key123')

    expect(result.uniqueOpens).toBe(4)
    expect(result.emailsReceived).toBe(10)
  })

  it('returns found=false on 404', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } })
    const result = await getBeehiivSubscriberStats('missing@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.rateLimited).toBeUndefined()
    expect(result.error).toBeUndefined()
  })

  it('returns rateLimited=true on 429', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 429 } })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.rateLimited).toBe(true)
  })

  it('returns error on 5xx', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      response: { status: 502, data: { message: 'Bad gateway' } },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.error).toBe('Bad gateway')
  })

  it('falls back to opens when unique_opens is missing', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: 'sub_1',
          status: 'active',
          stats: { emails_received: 3, opens: 2 },
        },
      },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.uniqueOpens).toBe(2)
  })

  it('returns 0 opens when stats absent', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: { data: { id: 'sub_1', status: 'active' } },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.uniqueOpens).toBe(0)
    expect(result.emailsReceived).toBe(0)
  })
})
