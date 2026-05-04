import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  fromMock,
  sendGridFinalMock,
  mailerliteFinalMock,
  slackAlertMock,
  archiveMock,
  recordAdUsageMock,
  recordAppUsageMock,
  recordPollUsageMock,
  recordSparkLoopUsageMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  sendGridFinalMock: vi.fn(),
  mailerliteFinalMock: vi.fn(),
  slackAlertMock: vi.fn(),
  archiveMock: vi.fn(),
  recordAdUsageMock: vi.fn(),
  recordAppUsageMock: vi.fn(),
  recordPollUsageMock: vi.fn(),
  recordSparkLoopUsageMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const shouldRunFinalSendMock = vi.fn()
vi.mock('@/lib/schedule-checker', () => ({
  ScheduleChecker: {
    shouldRunFinalSend: (...args: unknown[]) => shouldRunFinalSendMock(...args),
  },
}))

const getEmailProviderSettingsMock = vi.fn()
vi.mock('@/lib/publication-settings', () => ({
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

vi.mock('@/lib/slack', () => ({
  SlackNotificationService: class MockSlackService {
    sendScheduledSendFailureAlert = slackAlertMock
  },
}))

vi.mock('@/lib/newsletter-archiver', () => ({
  newsletterArchiver: {
    archiveNewsletter: (...args: unknown[]) => archiveMock(...args),
  },
}))

vi.mock('@/lib/ad-modules', () => ({
  ModuleAdSelector: {
    recordUsageSimple: (...args: unknown[]) => recordAdUsageMock(...args),
  },
}))

vi.mock('@/lib/ai-app-modules', () => ({
  AppModuleSelector: {
    recordUsage: (...args: unknown[]) => recordAppUsageMock(...args),
  },
}))

vi.mock('@/lib/poll-modules', () => ({
  PollModuleSelector: {
    recordUsage: (...args: unknown[]) => recordPollUsageMock(...args),
  },
}))

vi.mock('@/lib/sparkloop-rec-modules', () => ({
  SparkLoopRecModuleSelector: {
    recordUsage: (...args: unknown[]) => recordSparkLoopUsageMock(...args),
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
  return new Request('http://localhost/api/cron/send-final') as any
}

interface Cfg {
  publications?: any[]
  issueRow?: any
  issueError?: any
  pollRow?: any
  pollError?: any
}

function setupFromMock(cfg: Cfg = {}) {
  const issueUpdateMock = vi.fn().mockReturnValue({
    eq: () => Promise.resolve({ data: null, error: null }),
  })

  const defaultIssue = {
    id: 'issue-1',
    publication_id: 'pub-1',
    date: '2026-05-04',
    status: 'in_review',
    subject_line: 'Final Subject',
    metrics: {},
    module_articles: [{ id: 'a-1', is_active: true, headline: 'h1', rank: 1, article_module_id: 'm1' }],
  }

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
              order: () => ({
                limit: () => ({
                  single: () =>
                    Promise.resolve({
                      data: cfg.issueRow === undefined ? defaultIssue : cfg.issueRow,
                      error: cfg.issueError ?? null,
                    }),
                }),
              }),
            }),
          }),
        }),
        update: issueUpdateMock,
      }
    }
    if (table === 'module_articles') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: 'a-1', headline: 'h1', rank: 1, is_active: true, article_module_id: 'm1', article_module: { name: 'Top' } }],
                  error: null,
                }),
            }),
            is: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }
    }
    if (table === 'manual_articles') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }
    }
    if (table === 'polls') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                single: () =>
                  Promise.resolve({
                    data: cfg.pollRow ?? null,
                    error: cfg.pollError ?? { code: 'PGRST116', message: 'no rows' },
                  }),
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'rss_posts') {
      return {
        update: () => ({
          in: () => Promise.resolve({ data: null, error: null }),
        }),
      }
    }
    return {}
  })

  return { issueUpdateMock }
}

describe('send-final cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFromMock()
    shouldRunFinalSendMock.mockResolvedValue(true)
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'sendgrid' })
    sendGridFinalMock.mockResolvedValue({ success: true, campaignId: 'sg-1' })
    mailerliteFinalMock.mockResolvedValue({ success: true, issueId: 'ml-1' })
    archiveMock.mockResolvedValue({ success: true })
    recordAdUsageMock.mockResolvedValue({ recorded: 1 })
    recordAppUsageMock.mockResolvedValue({ recorded: 0 })
    recordPollUsageMock.mockResolvedValue({ recorded: 0 })
    recordSparkLoopUsageMock.mockResolvedValue({ recorded: 0 })
    slackAlertMock.mockResolvedValue(undefined)
  })

  it('happy path: SendGrid sends, status set to sent, archiver called', async () => {
    const { issueUpdateMock } = setupFromMock()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.results[0]).toMatchObject({ success: true })
    expect(sendGridFinalMock).toHaveBeenCalledTimes(1)
    expect(archiveMock).toHaveBeenCalledTimes(1)
    expect(issueUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        status_before_send: 'in_review',
      })
    )
    expect(slackAlertMock).not.toHaveBeenCalled()
  })

  it('happy path: MailerLite sends when provider is mailerlite', async () => {
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite', mainGroupId: 'g-1' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(mailerliteFinalMock).toHaveBeenCalledTimes(1)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('schedule gate: skips when shouldRunFinalSend returns false', async () => {
    shouldRunFinalSendMock.mockResolvedValue(false)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('skips when no in_review or changes_made issue exists', async () => {
    setupFromMock({ issueRow: null, issueError: { code: 'PGRST116' } })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/No issue/i)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('module-recording failure tolerance: ad module throws, send still completes', async () => {
    recordAdUsageMock.mockRejectedValueOnce(new Error('ad recorder broken'))
    const { issueUpdateMock } = setupFromMock()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(sendGridFinalMock).toHaveBeenCalled()
    expect(issueUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' })
    )
    expect(slackAlertMock).not.toHaveBeenCalled() // non-fatal, no slack alert
  })

  it('archiver failure tolerance: archiver throws, status still set to sent', async () => {
    archiveMock.mockRejectedValueOnce(new Error('archive bucket down'))
    const { issueUpdateMock } = setupFromMock()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(issueUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' })
    )
  })

  it('provider failure: Slack alert fires, status NOT updated to sent', async () => {
    sendGridFinalMock.mockResolvedValueOnce({ success: false, error: 'SendGrid 500' })
    const { issueUpdateMock } = setupFromMock()

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(slackAlertMock).toHaveBeenCalledTimes(1)
    expect(issueUpdateMock).not.toHaveBeenCalled()
  })

  it('multi-publication: one pub fails, the other still sends', async () => {
    setupFromMock({
      publications: [
        { id: 'pub-1', name: 'A', slug: 'a' },
        { id: 'pub-2', name: 'B', slug: 'b' },
      ],
    })
    // First call (pub-1) fails, second call (pub-2) succeeds
    sendGridFinalMock
      .mockResolvedValueOnce({ success: false, error: 'pub-1 failed' })
      .mockResolvedValueOnce({ success: true, campaignId: 'sg-2' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results).toHaveLength(2)
    expect(body.results[0].success).toBe(false)
    expect(body.results[1].success).toBe(true)
    expect(sendGridFinalMock).toHaveBeenCalledTimes(2)
    expect(slackAlertMock).toHaveBeenCalledTimes(1) // only for the failing pub
  })
})
