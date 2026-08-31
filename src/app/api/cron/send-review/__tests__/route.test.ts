import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fromMock, sendGridReviewMock, mailerliteReviewMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  sendGridReviewMock: vi.fn(),
  mailerliteReviewMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const shouldRunReviewSendMock = vi.fn()
const shouldCatchUpReviewSendMock = vi.fn()
vi.mock('@/lib/schedule-checker', () => ({
  ScheduleChecker: {
    shouldRunReviewSend: (...args: unknown[]) => shouldRunReviewSendMock(...args),
    shouldCatchUpReviewSend: (...args: unknown[]) => shouldCatchUpReviewSendMock(...args),
  },
}))

const getEmailProviderSettingsMock = vi.fn()
vi.mock('@/lib/publication-settings', () => ({
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

vi.mock('@/lib/sendgrid', () => ({
  SendGridService: class MockSendGridService {
    createReviewCampaign = sendGridReviewMock
  },
}))

vi.mock('@/lib/mailerlite', () => ({
  MailerLiteService: class MockMailerLiteService {
    createReviewissue = mailerliteReviewMock
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
  return new Request('http://localhost/api/cron/send-review') as any
}

interface IssueCfg {
  issueRow?: any
  /** Explicit multi-row result; overrides issueRow. Use to simulate duplicates. */
  issueRows?: any[]
  issueError?: any
  publications?: any[]
}

function setupFromMock(cfg: IssueCfg = {}) {
  const issueLookupArgs: Record<string, string> = {}

  const defaultIssue = {
    id: 'issue-1',
    publication_id: 'pub-1',
    date: '2026-05-05',
    status: 'draft',
    subject_line: 'Tomorrow tomorrow',
    module_articles: [{ id: 'a-1', is_active: true }],
    manual_articles: [],
  }

  const issueRow = cfg.issueRow === undefined ? defaultIssue : cfg.issueRow

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
          eq: function captureEq(col: string, val: string): any {
            issueLookupArgs[col] = val
            return {
              eq: function captureEq2(c2: string, v2: string): any {
                issueLookupArgs[c2] = v2
                return {
                  eq: function captureEq3(c3: string, v3: string): any {
                    issueLookupArgs[c3] = v3
                    // Route fetches up to 2 rows so it can tell "none" from "duplicates"
                    return {
                      order: () => ({
                        limit: () =>
                          Promise.resolve({
                            data: cfg.issueRows ?? (issueRow == null ? [] : [issueRow]),
                            error: cfg.issueError ?? null,
                          }),
                      }),
                    }
                  },
                }
              },
            }
          },
        }),
      }
    }
    return {}
  })

  return { issueLookupArgs }
}

describe('send-review cron', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Today CT = 2026-05-04, tomorrow CT = 2026-05-05
    vi.setSystemTime(new Date('2026-05-04T20:00:00Z'))
    vi.clearAllMocks()
    setupFromMock()
    shouldRunReviewSendMock.mockResolvedValue(true)
    shouldCatchUpReviewSendMock.mockResolvedValue(false)
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'sendgrid' })
    sendGridReviewMock.mockResolvedValue({ success: true, campaignId: 'sg-1' })
    mailerliteReviewMock.mockResolvedValue({ success: true, issueId: 'ml-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('happy path: sends review for tomorrow\'s draft via SendGrid', async () => {
    const { issueLookupArgs } = setupFromMock()
    shouldRunReviewSendMock.mockResolvedValue(true)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.results[0]).toMatchObject({ success: true })
    expect(issueLookupArgs.publication_id).toBe('pub-1') // multi-tenant filter
    expect(issueLookupArgs.date).toBe('2026-05-05') // tomorrow CT
    expect(issueLookupArgs.status).toBe('draft')
    expect(sendGridReviewMock).toHaveBeenCalledTimes(1)
  })

  it('catch-up: proceeds when shouldRunReviewSend=false but shouldCatchUpReviewSend=true', async () => {
    shouldRunReviewSendMock.mockResolvedValue(false)
    shouldCatchUpReviewSendMock.mockResolvedValue(true)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].success).toBe(true)
    expect(sendGridReviewMock).toHaveBeenCalled()
  })

  it('skips when no draft issue found for tomorrow', async () => {
    // A list query returns an empty array, not PGRST116 (that is .single()-only)
    setupFromMock({ issueRows: [] })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/No draft issue/i)
    expect(sendGridReviewMock).not.toHaveBeenCalled()
  })

  it('REGRESSION: reports failure (not a silent skip) when the date has duplicate drafts', async () => {
    // Two issues for one date used to make .single() return PGRST116, which this
    // route reported as success+skipped. 10 sends were lost this way before anyone
    // noticed. Duplicates must now fail loudly.
    setupFromMock({
      issueRows: [
        { id: 'issue-1', publication_id: 'pub-1', date: '2026-05-05', status: 'draft', subject_line: 'A', module_articles: [{ id: 'a-1', is_active: true }], manual_articles: [] },
        { id: 'issue-2', publication_id: 'pub-1', date: '2026-05-05', status: 'draft', subject_line: 'B', module_articles: [{ id: 'a-2', is_active: true }], manual_articles: [] },
      ],
    })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.results[0].skipped).toBeUndefined()
    expect(body.results[0].error).toMatch(/Multiple draft issues/i)
    expect(sendGridReviewMock).not.toHaveBeenCalled()
  })

  it('reports failure when the draft issue query errors', async () => {
    setupFromMock({ issueRows: [], issueError: { code: '57014', message: 'statement timeout' } })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.results[0].error).toMatch(/statement timeout/i)
    expect(sendGridReviewMock).not.toHaveBeenCalled()
  })

  it('reports error when subject line is missing', async () => {
    setupFromMock({
      issueRow: {
        id: 'issue-1',
        publication_id: 'pub-1',
        date: '2026-05-05',
        status: 'draft',
        subject_line: '   ',
        module_articles: [{ id: 'a-1', is_active: true }],
      },
    })

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.results[0].error).toMatch(/No subject line/i)
    expect(sendGridReviewMock).not.toHaveBeenCalled()
  })

  it('schedule gate: skips when both shouldRun and shouldCatchUp are false', async () => {
    shouldRunReviewSendMock.mockResolvedValue(false)
    shouldCatchUpReviewSendMock.mockResolvedValue(false)

    const response = await GET(buildRequest(), { params: Promise.resolve({}) })
    const body = await response.json()

    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].message).toMatch(/Not time/i)
    expect(sendGridReviewMock).not.toHaveBeenCalled()
  })

  it('Central Time date rollover: tomorrow correctly crosses month boundary', async () => {
    // Today CT = 2026-04-30, tomorrow CT = 2026-05-01
    vi.setSystemTime(new Date('2026-04-30T20:00:00Z'))
    const { issueLookupArgs } = setupFromMock()

    await GET(buildRequest(), { params: Promise.resolve({}) })

    expect(issueLookupArgs.date).toBe('2026-05-01')
  })
})
