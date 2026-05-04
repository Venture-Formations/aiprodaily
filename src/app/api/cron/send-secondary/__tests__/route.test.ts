import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fromMock, sendGridFinalMock, mailerliteFinalMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  sendGridFinalMock: vi.fn(),
  mailerliteFinalMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const getPublicationSettingMock = vi.fn()
const getEmailProviderSettingsMock = vi.fn()
vi.mock('@/lib/publication-settings', () => ({
  getPublicationSetting: (...args: unknown[]) => getPublicationSettingMock(...args),
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

vi.mock('@/lib/sendgrid', () => ({
  SendGridService: class MockSendGridService {
    createFinalCampaign = sendGridFinalMock
  },
}))

vi.mock('@/lib/mailerlite', () => ({
  MailerLiteService: class MockMailerLiteService {
    createFinalissue = mailerliteFinalMock
  },
}))

vi.mock('@/lib/env-guard', () => ({
  getEnvironment: () => 'test',
  isProduction: () => false,
  shouldSkipScheduleCheck: () => false,
}))

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (_opts: unknown, fn: any) => async (req: any) =>
    fn({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, request: req }),
}))

import { GET } from '../route'

function buildRequest() {
  return new Request('http://localhost/api/cron/send-secondary') as any
}

const TODAY_LOCAL = new Date('2026-05-04T20:00:00Z') // Monday in CT (dayOfWeek=1)
const TODAY_DATE_STR = '2026-05-04'

interface Cfg {
  publications?: any[]
  issueRow?: any
  issueError?: any
  moduleArticles?: any[]
  updateError?: any
}

function setupFromMock(cfg: Cfg = {}) {
  const updateMock = vi.fn().mockReturnValue({
    eq: () => Promise.resolve({ data: null, error: cfg.updateError ?? null }),
  })

  const issueRow =
    cfg.issueRow === undefined
      ? {
          id: 'issue-1',
          date: TODAY_DATE_STR,
          status: 'in_review',
          subject_line: 'Subject',
          secondary_sent_at: null,
          publication_id: 'pub-1',
          created_at: '2026-05-04T05:00:00Z',
          metrics: {},
        }
      : cfg.issueRow

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
    if (table === 'publication_issues') {
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    single: () => Promise.resolve({ data: issueRow, error: cfg.issueError ?? null }),
                  }),
                }),
              }),
            }),
          }),
        }),
        update: updateMock,
      }
    }
    if (table === 'module_articles') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: () =>
                Promise.resolve({
                  data:
                    cfg.moduleArticles ?? [
                      { id: 'a-1', headline: 'h', content: 'c', rank: 1, is_active: true, final_position: 1, article_module_id: 'm', post_id: 'p' },
                    ],
                  error: null,
                }),
            }),
          }),
        }),
      }
    }
    return {}
  })

  return { updateMock }
}

function setupSettings(overrides: Record<string, string | null> = {}) {
  const defaults: Record<string, string | null> = {
    email_secondaryScheduleEnabled: 'true',
    secondary_send_days: '[1,2,3,4,5]',
    sendgrid_secondary_list_id: 'list-123',
  }
  const merged = { ...defaults, ...overrides }
  getPublicationSettingMock.mockImplementation(async (_pub: string, key: string) => merged[key] ?? null)
}

describe('send-secondary cron', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY_LOCAL)
    vi.clearAllMocks()
    setupFromMock()
    setupSettings()
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'sendgrid' })
    sendGridFinalMock.mockResolvedValue({ success: true, campaignId: 'sg-1', issueId: 'issue-1' })
    mailerliteFinalMock.mockResolvedValue({ success: true, issueId: 'ml-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('happy path: SendGrid secondary send updates secondary_sent_at and metrics', async () => {
    const { updateMock } = setupFromMock()
    setupSettings()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.results[0]).toMatchObject({ pubId: 'pub-1', success: true })
    expect(sendGridFinalMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'issue-1' }), true)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secondary_sent_at: expect.any(String),
        metrics: expect.objectContaining({ sendgrid_secondary_singlesend_id: 'sg-1' }),
      })
    )
  })

  it('skips when secondary schedule is disabled', async () => {
    setupSettings({ email_secondaryScheduleEnabled: 'false' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/disabled/i)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('skips when day-of-week is not in configured send days', async () => {
    // Today is Monday (1). Configure to only send on weekends.
    setupSettings({ secondary_send_days: '[0,6]' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/Not a configured send day/i)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('falls back to Mon–Fri default when secondary_send_days JSON is invalid', async () => {
    // Invalid JSON → fallback [1,2,3,4,5]. Today is Monday (1) → send proceeds.
    setupSettings({ secondary_send_days: '{not json' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(sendGridFinalMock).toHaveBeenCalled()
  })

  it('reports error when secondary list ID is not configured', async () => {
    setupSettings({ sendgrid_secondary_list_id: null })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error).toMatch(/Secondary list ID not configured/i)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('skips when secondary_sent_at is already set for today', async () => {
    setupFromMock({
      issueRow: {
        id: 'issue-1',
        date: TODAY_DATE_STR,
        status: 'sent',
        subject_line: 'S',
        secondary_sent_at: TODAY_LOCAL.toISOString(),
        publication_id: 'pub-1',
        created_at: '2026-05-04T05:00:00Z',
        metrics: {},
      },
    })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/already completed/i)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('reports error and does not record send when provider call fails', async () => {
    sendGridFinalMock.mockResolvedValueOnce({ success: false, error: 'SendGrid down' })
    const { updateMock } = setupFromMock()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.results[0].error).toMatch(/SendGrid down/i)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
