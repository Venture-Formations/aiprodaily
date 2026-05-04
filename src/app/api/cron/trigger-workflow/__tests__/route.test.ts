import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const shouldRunRSSProcessingMock = vi.fn()
vi.mock('@/lib/schedule-checker', () => ({
  ScheduleChecker: {
    shouldRunRSSProcessing: (...args: unknown[]) => shouldRunRSSProcessingMock(...args),
  },
}))

const startMock = vi.fn()
vi.mock('workflow/api', () => ({
  start: (...args: unknown[]) => startMock(...args),
}))

vi.mock('@/lib/workflows/process-rss-workflow', () => ({
  processRSSWorkflow: { __mocked: true },
}))

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (_opts: unknown, fn: any) => async (req: any) =>
    fn({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, request: req }),
}))

import { GET } from '../route'

function buildRequest() {
  return new Request('http://localhost/api/cron/trigger-workflow') as any
}

interface PublicationsConfig {
  publications?: any[]
  stuckCampaigns?: any[]
  articleCounts?: Record<string, number>
  welcomeSections?: Record<string, string | null>
}

function setupFromMock(cfg: PublicationsConfig = {}) {
  const updateMock = vi.fn().mockReturnValue({
    eq: () => Promise.resolve({ data: null, error: null }),
  })

  fromMock.mockImplementation((table: string) => {
    if (table === 'publications') {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: cfg.publications ?? [{ id: 'pub-1', name: 'AI Pros Daily', slug: 'aiprodaily' }],
              error: null,
            }),
        }),
      }
    }
    if (table === 'newsletter_campaigns') {
      return {
        select: (cols: string) => {
          if (cols.includes('welcome_section')) {
            return {
              eq: (_col: string, id: string) => ({
                single: () =>
                  Promise.resolve({
                    data: { welcome_section: cfg.welcomeSections?.[id] ?? null },
                    error: null,
                  }),
              }),
            }
          }
          return {
            eq: () => ({
              lt: () =>
                Promise.resolve({
                  data: cfg.stuckCampaigns ?? [],
                  error: null,
                }),
            }),
          }
        },
        update: updateMock,
      }
    }
    if (table === 'module_articles') {
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            eq: () =>
              Promise.resolve({
                data: null,
                count: cfg.articleCounts?.[id] ?? 0,
                error: null,
              }),
          }),
        }),
      }
    }
    return {}
  })

  return { updateMock }
}

describe('trigger-workflow cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFromMock()
    shouldRunRSSProcessingMock.mockResolvedValue(false)
    startMock.mockResolvedValue(undefined)
  })

  it('starts workflow for an eligible publication', async () => {
    shouldRunRSSProcessingMock.mockResolvedValue(true)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.newsletters).toEqual(['AI Pros Daily'])
    expect(startMock).toHaveBeenCalledTimes(1)
    expect(startMock).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ trigger: 'cron', publication_id: 'pub-1' })]
    )
  })

  it('skips workflow start when schedule gate is closed', async () => {
    shouldRunRSSProcessingMock.mockResolvedValue(false)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.skipped).toBe(true)
    expect(body.message).toBe('No workflows scheduled at this time')
    expect(startMock).not.toHaveBeenCalled()
  })

  it('OIDC recovery: ≥3 articles + welcome_section → flips status to draft', async () => {
    const stuckId = 'stuck-1'
    const { updateMock } = setupFromMock({
      stuckCampaigns: [
        { id: stuckId, publication_id: 'pub-1', status: 'processing', created_at: '2026-04-01' },
      ],
      articleCounts: { [stuckId]: 5 },
      welcomeSections: { [stuckId]: '<welcome>' },
    })

    await GET(buildRequest(), { params: Promise.resolve({}) })

    expect(updateMock).toHaveBeenCalledWith({ status: 'draft' })
  })

  it('OIDC recovery: ≥3 articles but no welcome_section → leaves status as processing', async () => {
    const stuckId = 'stuck-2'
    const { updateMock } = setupFromMock({
      stuckCampaigns: [
        { id: stuckId, publication_id: 'pub-1', status: 'processing', created_at: '2026-04-01' },
      ],
      articleCounts: { [stuckId]: 5 },
      welcomeSections: { [stuckId]: null },
    })

    await GET(buildRequest(), { params: Promise.resolve({}) })

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('propagates workflow start failure (no silent swallow)', async () => {
    shouldRunRSSProcessingMock.mockResolvedValue(true)
    startMock.mockRejectedValueOnce(new Error('workflow infra down'))

    await expect(GET(buildRequest(), { params: Promise.resolve({}) })).rejects.toThrow(
      'workflow infra down'
    )
  })
})
