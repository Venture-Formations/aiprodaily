import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getBeehiivSubscriberStats } from '../beehiiv'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('getBeehiivSubscriberStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed stats for an active subscriber with opens', async () => {
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

    expect(result.found).toBe(true)
    expect(result.status).toBe('active')
    expect(result.uniqueOpens).toBe(4)
    expect(result.emailsReceived).toBe(10)
    expect(result.subscriptionId).toBe('sub_abc123')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.beehiiv.com/v2/publications/pub_xyz/subscriptions/by_email/user%40example.com?expand=stats',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer key123' }) }),
    )
  })
})
