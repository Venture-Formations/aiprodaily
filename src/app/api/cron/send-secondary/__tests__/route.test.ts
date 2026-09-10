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

  it('does NOT select forbidden columns from manual_articles (regression: rank/is_active)', async () => {
    // Regression for the silent failure that broke every Thursday secondary
    // send from 2026-03-31 onward: selecting `rank` triggered PostgREST 42809
    // (rank ordered-set aggregate), `is_active` triggered 42703 (no such column).
    // Both got swallowed as "No issue found for today".
    const selectSpy = vi.fn().mockReturnValue({
      eq: () => ({
        in: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({
                  data: { id: 'issue-1', date: TODAY_DATE_STR, status: 'in_review', subject_line: 'S', secondary_sent_at: null, publication_id: 'pub-1', created_at: '2026-05-04T05:00:00Z', metrics: {} },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })
    fromMock.mockImplementation((table: string) => {
      if (table === 'publications') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'pub-1', name: 'AI Pros Daily', slug: 'aiprodaily' }], error: null }) }) }
      }
      if (table === 'publication_issues') {
        return { select: selectSpy, update: vi.fn().mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) }) }
      }
      if (table === 'module_articles') {
        return { select: () => ({ eq: () => ({ eq: () => ({ not: () => Promise.resolve({ data: [{ id: 'a-1', headline: 'h', content: 'c', rank: 1, is_active: true, final_position: 1, article_module_id: 'm', post_id: 'p' }], error: null }) }) }) }) }
      }
      return {}
    })

    await GET(buildRequest(), { params: Promise.resolve({}) })

    expect(selectSpy).toHaveBeenCalled()
    const issueSelect: string = selectSpy.mock.calls[0][0]
    // The forbidden tokens should not appear inside the manual_articles join
    const manualArticlesPart = issueSelect.match(/manual_articles:manual_articles\(([^)]*)\)/)?.[1] ?? ''
    expect(manualArticlesPart).not.toMatch(/\brank\b/)
    expect(manualArticlesPart).not.toMatch(/\bis_active\b/)
  })

  it('surfaces PostgREST errors on issue lookup instead of silently skipping', async () => {
    // Regression: previously `if (error || !issue)` lumped real PostgREST errors
    // (broken query, RLS, etc.) into the same "No issue found for today" skip
    // path with success:true, hiding bugs for weeks. Real errors must report
    // success:false with the underlying code.
    setupFromMock({ issueError: { code: '42809', message: 'WITHIN GROUP is required for ordered-set aggregate rank' }, issueRow: null })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error).toMatch(/42809/)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })
})

const slackAlertMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/slack', () => ({
  SlackNotificationService: class MockSlackService {
    alertUnscheduledCampaign = slackAlertMock
  },
}))

// ===========================================================================
// Weekday timezone regression
//
// Production bug: the send-day check read the weekday off `new Date().getDay()`,
// which is UTC on Vercel, while the issue was resolved by CT date. Between
// 19:00 CT and midnight CT the two disagree, so AI Accounting Daily's
// Thursday-only secondary fired every Wednesday evening against Wednesday's
// already-sent issue and scheduled it for a time 13 hours in the past.
// ===========================================================================
describe('send-secondary cron - send day is evaluated in Central Time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setupFromMock()
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'sendgrid' })
    sendGridFinalMock.mockResolvedValue({ success: true, campaignId: 'sg-1', issueId: 'issue-1' })
    mailerliteFinalMock.mockResolvedValue({ success: true, issueId: 'ml-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire Wednesday evening CT even though the UTC clock says Thursday', async () => {
    // 2026-09-10 00:30 UTC === 2026-09-09 19:30 CDT (Wednesday)
    vi.setSystemTime(new Date('2026-09-10T00:30:00Z'))
    setupSettings({ secondary_send_days: '[4]' }) // Thursday only

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/Not a configured send day \(3\)/)
    expect(sendGridFinalMock).not.toHaveBeenCalled()
  })

  it('fires on Thursday morning CT', async () => {
    // 2026-09-10 10:30 UTC === 2026-09-10 05:30 CDT (Thursday)
    vi.setSystemTime(new Date('2026-09-10T10:30:00Z'))
    setupSettings({ secondary_send_days: '[4]' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(sendGridFinalMock).toHaveBeenCalled()
  })

  it('still fires Wednesday evening CT when Wednesday is a configured send day', async () => {
    vi.setSystemTime(new Date('2026-09-10T00:30:00Z')) // Wed 19:30 CDT
    setupSettings({ secondary_send_days: '[3]' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(sendGridFinalMock).toHaveBeenCalled()
  })
})

// ===========================================================================
// Unscheduled-campaign reporting
//
// createFinalissue deliberately does not throw when MailerLite rejects the
// schedule, so this path returned a bare success for months while the campaign
// sat in MailerLite as an unsent draft.
// ===========================================================================
describe('send-secondary cron - unscheduled campaign is surfaced', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY_LOCAL)
    vi.clearAllMocks()
    setupFromMock()
    setupSettings()
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite', secondaryGroupId: 'g-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('alerts Slack when the campaign was created but not scheduled', async () => {
    const { updateMock } = setupFromMock()
    setupSettings()
    mailerliteFinalMock.mockResolvedValue({
      success: true,
      issueId: 'ml-1',
      scheduleFailure: {
        reason: 'The schedule date must be a date after or equal to 2026-09-10 05:25.',
        requestedTime: '2026-09-10 05:25 CT',
      },
    })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(slackAlertMock).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({
        reason: expect.stringMatching(/after or equal to/),
        requestedTime: expect.stringContaining('05:25'),
      }),
      expect.objectContaining({ sendType: 'secondary', publicationSlug: 'aiprodaily' })
    )
    // The campaign exists in MailerLite, so the send is still recorded: retrying
    // would create a duplicate campaign rather than fix the unscheduled one.
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ secondary_sent_at: expect.any(String) })
    )
    expect(body.results[0].success).toBe(true)
    expect(body.results[0].message).toMatch(/not scheduled/i)
  })

  it('does not alert when the campaign scheduled cleanly', async () => {
    mailerliteFinalMock.mockResolvedValue({ success: true, issueId: 'ml-1' })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(slackAlertMock).not.toHaveBeenCalled()
    expect(body.results[0].success).toBe(true)
  })
})
