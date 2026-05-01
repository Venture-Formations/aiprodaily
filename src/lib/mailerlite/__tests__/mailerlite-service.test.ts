import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Captured interceptor handlers, populated when the SUT module is loaded.
// We re-invoke them directly to test retry/circuit-breaker logic in isolation.
// ---------------------------------------------------------------------------
const captured = vi.hoisted(() => ({
  requestInterceptor: undefined as ((config: any) => Promise<any>) | undefined,
  responseSuccessHandler: undefined as ((res: any) => any) | undefined,
  responseErrorHandler: undefined as ((err: any) => Promise<any>) | undefined,
}))

const mockClient = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  request: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}))

const axiosCreateSpy = vi.hoisted(() => vi.fn((..._args: any[]) => mockClient))

vi.mock('axios', () => {
  class Cancel {
    constructor(public message: string) {}
  }
  return {
    default: {
      create: axiosCreateSpy,
      Cancel,
      isAxiosError: vi.fn(() => true),
    },
  }
})

// Supabase chainable response queue (same pattern as ad-scheduler.test.ts).
type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  fromCalls: [] as string[],
  insertCalls: [] as any[],
  updateCalls: [] as any[],
  eqCalls: [] as Array<[string, any]>,
}))

function makeSupaChain(response: SupaResponse): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((col: string, val: any) => {
    supabase.eqCalls.push([col, val])
    return chain
  })
  chain.not = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.insert = vi.fn((payload: any) => {
    supabase.insertCalls.push(payload)
    return chain
  })
  chain.update = vi.fn((payload: any) => {
    supabase.updateCalls.push(payload)
    return chain
  })
  chain.upsert = vi.fn((payload: any) => {
    supabase.updateCalls.push(payload)
    return chain
  })
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      supabase.fromCalls.push(table)
      const response = supabase.responseQueue.shift() ?? { data: null, error: null }
      return makeSupaChain(response)
    }),
  },
}))

vi.mock('../../slack', () => ({
  ErrorHandler: class {
    handleError = vi.fn().mockResolvedValue(undefined)
    logInfo = vi.fn().mockResolvedValue(undefined)
  },
  SlackNotificationService: class {
    sendEmailIssueAlert = vi.fn().mockResolvedValue(undefined)
  },
}))

vi.mock('../../publication-settings', () => ({
  getEmailSettings: vi.fn(),
  getScheduleSettings: vi.fn(),
  getPublicationSetting: vi.fn(),
  getPublicationSettings: vi.fn(),
}))

vi.mock('../../newsletter-templates', () => ({
  generateFullNewsletterHtml: vi.fn(() => '<html>newsletter</html>'),
}))

vi.mock('../../env-guard', () => ({
  getEnvironment: vi.fn(() => 'production'),
  isProduction: vi.fn(() => true),
}))

vi.mock('../../remediation/circuit-breaker', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordRateLimitHit: vi.fn().mockResolvedValue({ tripped: false }),
}))

// Now import the SUT — module-load wires up the interceptors.
import { MailerLiteService } from '../mailerlite-service'
import {
  getEmailSettings,
  getScheduleSettings,
  getPublicationSetting,
  getPublicationSettings,
} from '../../publication-settings'
import { isCircuitOpen, recordRateLimitHit } from '../../remediation/circuit-breaker'

// Capture interceptor handlers right after the module loads.
;(() => {
  const requestUseCalls = (mockClient.interceptors.request.use as any).mock.calls
  const responseUseCalls = (mockClient.interceptors.response.use as any).mock.calls
  if (requestUseCalls.length > 0) captured.requestInterceptor = requestUseCalls[0][0]
  if (responseUseCalls.length > 0) {
    captured.responseSuccessHandler = responseUseCalls[0][0]
    captured.responseErrorHandler = responseUseCalls[0][1]
  }
})()

const mockedGetEmailSettings = vi.mocked(getEmailSettings)
const mockedGetScheduleSettings = vi.mocked(getScheduleSettings)
const mockedGetPublicationSetting = vi.mocked(getPublicationSetting)
const mockedGetPublicationSettings = vi.mocked(getPublicationSettings)
const mockedIsCircuitOpen = vi.mocked(isCircuitOpen)
const mockedRecordRateLimitHit = vi.mocked(recordRateLimitHit)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides: Record<string, any> = {}) {
  return {
    id: 'issue-uuid-1',
    publication_id: 'pub-1',
    date: '2026-05-15',
    subject_line: 'Test Subject',
    ...overrides,
  } as any
}

// Sets up the shared mocks every campaign method needs (settings, HTTP, plain
// text generation). Pushes the publications-lookup response. Tests must queue
// method-specific supabase responses themselves (publication_issues update,
// email_metrics check + write, etc.) since each method has a different shape.
function setupCampaignHappyPath(opts: { reviewGroupId?: string } = {}) {
  // publications.select.eq.single
  supabase.responseQueue.push({ data: { slug: 'aiprodaily' }, error: null })

  mockedGetEmailSettings.mockResolvedValue({
    sender_name: 'AI Pros Daily',
    from_email: 'hi@aiprodaily.com',
    review_group_id: opts.reviewGroupId ?? 'review-group-1',
    subject_line_emoji: '🧮',
    mailerlite_group_id: 'main-group-1',
  })

  mockedGetPublicationSettings.mockResolvedValue({
    newsletter_name: 'AI Pros Daily',
    business_name: 'Venture Formations',
    business_address: '123 Main St, Austin, TX 78701',
  })

  mockedGetScheduleSettings.mockResolvedValue({
    review_send_time: '21:00',
    final_send_time: '04:55',
    timezone_id: 157,
  })

  mockedGetPublicationSetting.mockImplementation(async (_pubId: string, key: string) => {
    if (key === 'email_timezone_id') return '157'
    if (key === 'email_secondaryScheduledSendTime') return '06:00'
    return null
  })

  mockClient.post.mockImplementation(async (url: string) => {
    if (url === '/campaigns') {
      return { status: 201, statusText: 'Created', data: { data: { id: 'ml-campaign-99' } }, headers: {} }
    }
    if (url.includes('/schedule')) {
      return { status: 200, statusText: 'OK', data: { data: {} }, headers: {} }
    }
    return { status: 200, data: {} }
  })
  mockClient.put.mockResolvedValue({ status: 200, statusText: 'OK', data: {}, headers: {} })
}

beforeEach(() => {
  // Suppress production console output to keep CI logs clean.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  supabase.responseQueue.length = 0
  supabase.fromCalls.length = 0
  supabase.insertCalls.length = 0
  supabase.updateCalls.length = 0
  supabase.eqCalls.length = 0

  mockClient.post.mockReset()
  mockClient.get.mockReset()
  mockClient.put.mockReset()
  mockClient.patch.mockReset()
  mockClient.request.mockReset()

  mockedGetEmailSettings.mockReset()
  mockedGetScheduleSettings.mockReset()
  mockedGetPublicationSetting.mockReset()
  mockedGetPublicationSettings.mockReset()
  mockedIsCircuitOpen.mockReset()
  mockedIsCircuitOpen.mockResolvedValue(false)
  mockedRecordRateLimitHit.mockReset()
  mockedRecordRateLimitHit.mockResolvedValue({ tripped: false })
})

afterEach(() => {
  vi.useRealTimers()
})

// ===========================================================================
// Module setup
// ===========================================================================
describe('MailerLite module setup', () => {
  it('creates an axios client with the MailerLite API base URL and bearer auth', () => {
    expect(axiosCreateSpy).toHaveBeenCalledTimes(1)
    const config = axiosCreateSpy.mock.calls[0]?.[0] as any
    expect(config?.baseURL).toBe('https://connect.mailerlite.com/api')
    expect(config?.headers?.Authorization).toMatch(/^Bearer /)
    expect(config?.headers?.['Content-Type']).toBe('application/json')
  })

  it('installs a request interceptor (circuit breaker)', () => {
    expect(captured.requestInterceptor).toBeDefined()
    expect(typeof captured.requestInterceptor).toBe('function')
  })

  it('installs a response interceptor (429 retry)', () => {
    expect(captured.responseSuccessHandler).toBeDefined()
    expect(captured.responseErrorHandler).toBeDefined()
  })
})

// ===========================================================================
// Circuit breaker request interceptor
// ===========================================================================
describe('Circuit breaker request interceptor', () => {
  it('rejects with axios.Cancel when isCircuitOpen returns true', async () => {
    mockedIsCircuitOpen.mockResolvedValueOnce(true)
    await expect(captured.requestInterceptor!({})).rejects.toMatchObject({
      message: expect.stringMatching(/circuit breaker is open/i),
    })
  })

  it('passes config through when circuit is closed', async () => {
    mockedIsCircuitOpen.mockResolvedValueOnce(false)
    const config = { url: '/campaigns' }
    await expect(captured.requestInterceptor!(config)).resolves.toBe(config)
  })
})

// ===========================================================================
// 429 retry response interceptor
// ===========================================================================
describe('429 retry response interceptor', () => {
  it('retries once on 429 using Retry-After header (in seconds, capped at 120s)', async () => {
    vi.useFakeTimers()
    mockClient.request.mockResolvedValueOnce({ status: 200, data: { ok: true } })

    const err = {
      response: { status: 429, headers: { 'retry-after': '5' } },
      config: {},
    }
    const promise = captured.responseErrorHandler!(err)
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result).toMatchObject({ status: 200 })
    expect(mockClient.request).toHaveBeenCalledTimes(1)
    expect(mockClient.request.mock.calls[0]?.[0]?._rateLimitAttempt).toBe(1)
  })

  it('falls back to 60s default wait when Retry-After header is absent', async () => {
    vi.useFakeTimers()
    mockClient.request.mockResolvedValueOnce({ status: 200, data: { ok: true } })

    const err = { response: { status: 429, headers: {} }, config: {} }
    const promise = captured.responseErrorHandler!(err)
    // Advance just under 60s — should NOT have retried yet.
    await vi.advanceTimersByTimeAsync(59_000)
    expect(mockClient.request).not.toHaveBeenCalled()
    // Advance past 60s — should now retry.
    await vi.advanceTimersByTimeAsync(2_000)
    await promise
    expect(mockClient.request).toHaveBeenCalledTimes(1)
  })

  it('caps Retry-After wait at 120 seconds even if the header asks for more', async () => {
    vi.useFakeTimers()
    mockClient.request.mockResolvedValueOnce({ status: 200, data: { ok: true } })

    const err = {
      response: { status: 429, headers: { 'retry-after': '999' } },
      config: {},
    }
    const promise = captured.responseErrorHandler!(err)
    await vi.advanceTimersByTimeAsync(120_000)
    await promise
    expect(mockClient.request).toHaveBeenCalledTimes(1)
  })

  it('stops retrying after 2 attempts (MAILERLITE_RATE_LIMIT_RETRY_ATTEMPTS)', async () => {
    const err = {
      response: { status: 429, headers: { 'retry-after': '1' } },
      config: { _rateLimitAttempt: 2 }, // already at max
    }
    await expect(captured.responseErrorHandler!(err)).rejects.toBe(err)
    expect(mockClient.request).not.toHaveBeenCalled()
  })

  it('does not retry on non-429 errors (4xx/5xx pass through)', async () => {
    const err500 = { response: { status: 500 }, config: {} }
    await expect(captured.responseErrorHandler!(err500)).rejects.toBe(err500)
    expect(mockClient.request).not.toHaveBeenCalled()

    const err400 = { response: { status: 400 }, config: {} }
    await expect(captured.responseErrorHandler!(err400)).rejects.toBe(err400)
    expect(mockClient.request).not.toHaveBeenCalled()
  })

  it('records a rate-limit hit on every 429 (for circuit-breaker tracking)', async () => {
    vi.useFakeTimers()
    mockClient.request.mockResolvedValueOnce({ status: 200, data: {} })

    const err = {
      response: { status: 429, headers: { 'retry-after': '1' } },
      config: {},
    }
    const promise = captured.responseErrorHandler!(err)
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(mockedRecordRateLimitHit).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// createReviewissue
// ===========================================================================
describe('MailerLiteService.createReviewissue', () => {
  it('happy path: POSTs /campaigns and writes review_sent_at to publication_issues', async () => {
    setupCampaignHappyPath()
    // publication_issues.update.eq → succeeds
    supabase.responseQueue.push({ data: null, error: null })

    const result = await new MailerLiteService().createReviewissue(makeIssue())

    expect(result).toEqual({ success: true, issueId: 'ml-campaign-99' })
    // /campaigns POST happened
    const campaignPost = mockClient.post.mock.calls.find(c => c[0] === '/campaigns')
    expect(campaignPost).toBeDefined()
    // publication_issues update fired with review_sent_at
    const issueUpdate = supabase.updateCalls.find(c => 'review_sent_at' in c)
    expect(issueUpdate).toBeDefined()
    expect(issueUpdate?.status).toBe('in_review')
  })

  it('throws when reviewGroupId is not configured in settings', async () => {
    setupCampaignHappyPath({ reviewGroupId: '' })

    await expect(
      new MailerLiteService().createReviewissue(makeIssue())
    ).rejects.toThrow(/Review Group ID not configured/)
  })

  it('uses forcedSubjectLine when provided, overriding issue.subject_line', async () => {
    setupCampaignHappyPath()
    supabase.responseQueue.push({ data: null, error: null })

    await new MailerLiteService().createReviewissue(
      makeIssue({ subject_line: 'Original' }),
      'Forced Subject!'
    )

    const campaignPost = mockClient.post.mock.calls.find(c => c[0] === '/campaigns')
    const subject = campaignPost?.[1]?.emails?.[0]?.subject
    expect(subject).toContain('Forced Subject!')
    expect(subject).not.toContain('Original')
  })

  it('throws and re-throws as a wrapped Error when /campaigns POST fails', async () => {
    // Override happy-path defaults BEFORE setupCampaignHappyPath sets them.
    supabase.responseQueue.push({ data: { slug: 'aiprodaily' }, error: null })
    mockedGetEmailSettings.mockResolvedValue({
      sender_name: 'X', from_email: 'x@y.com', review_group_id: 'rg', subject_line_emoji: '🧮', mailerlite_group_id: 'mg',
    })
    mockedGetPublicationSettings.mockResolvedValue({})
    // Production code unwraps axios-style errors only when `error instanceof Error`
    // AND `'response' in error`. Construct a real Error and attach .response.
    const apiError: any = new Error('Request failed with status code 500')
    apiError.response = { status: 500, statusText: 'Internal', data: { error: 'boom' } }
    mockClient.post.mockRejectedValueOnce(apiError)

    await expect(
      new MailerLiteService().createReviewissue(makeIssue())
    ).rejects.toThrow(/MailerLite API Error: 500/)
  })
})

// ===========================================================================
// createTestIssue
// ===========================================================================
describe('MailerLiteService.createTestIssue', () => {
  it('happy path: returns campaignId when /campaigns POST succeeds', async () => {
    setupCampaignHappyPath()

    const result = await new MailerLiteService().createTestIssue(makeIssue(), 'test-group-1')

    expect(result).toEqual({ success: true, campaignId: 'ml-campaign-99' })
  })

  it('targets the test group passed in (not the production main group)', async () => {
    setupCampaignHappyPath()

    await new MailerLiteService().createTestIssue(makeIssue(), 'test-group-XYZ')

    const campaignPost = mockClient.post.mock.calls.find(c => c[0] === '/campaigns')
    expect(campaignPost?.[1]?.groups).toEqual(['test-group-XYZ'])
  })

  it('throws when /campaigns POST fails', async () => {
    supabase.responseQueue.push({ data: { slug: 'pub' }, error: null })
    mockedGetEmailSettings.mockResolvedValue({
      sender_name: 'X', from_email: 'x@y.com', review_group_id: 'rg', subject_line_emoji: '', mailerlite_group_id: 'mg',
    })
    mockedGetPublicationSettings.mockResolvedValue({})
    mockClient.post.mockRejectedValueOnce(new Error('network down'))

    await expect(
      new MailerLiteService().createTestIssue(makeIssue(), 'test-group-1')
    ).rejects.toThrow(/network down/)
  })
})

// ===========================================================================
// createFinalissue
// ===========================================================================
describe('MailerLiteService.createFinalissue', () => {
  it('happy path (primary): inserts mailerlite_issue_id into email_metrics when no row exists', async () => {
    setupCampaignHappyPath()
    // email_metrics.select.eq.single → no existing row
    supabase.responseQueue.push({ data: null, error: null })
    // email_metrics.insert → succeeds
    supabase.responseQueue.push({ data: null, error: null })

    const result = await new MailerLiteService().createFinalissue(makeIssue(), 'main-group-1', false)

    expect(result).toEqual({ success: true, issueId: 'ml-campaign-99' })
    // email_metrics insert happened with mailerlite_issue_id
    const metricsInsert = supabase.insertCalls.find(c => 'mailerlite_issue_id' in c)
    expect(metricsInsert?.mailerlite_issue_id).toBe('ml-campaign-99')
    expect(metricsInsert?.issue_id).toBe('issue-uuid-1')
  })

  it('happy path (primary, existing metrics row): updates instead of inserting', async () => {
    setupCampaignHappyPath()
    // email_metrics.select.eq.single → existing row
    supabase.responseQueue.push({ data: { id: 'metrics-row-1' }, error: null })
    // email_metrics.update.eq → succeeds
    supabase.responseQueue.push({ data: null, error: null })

    await new MailerLiteService().createFinalissue(makeIssue(), 'main-group-1', false)

    // The metrics update should have included mailerlite_issue_id.
    const metricsUpdate = supabase.updateCalls.find(c => c.mailerlite_issue_id === 'ml-campaign-99')
    expect(metricsUpdate).toBeDefined()
    // No insert with mailerlite_issue_id since the row already existed.
    const metricsInsert = supabase.insertCalls.find(c => 'mailerlite_issue_id' in c)
    expect(metricsInsert).toBeUndefined()
  })

  it('secondary send (isSecondary=true) does NOT write mailerlite_issue_id to email_metrics', async () => {
    setupCampaignHappyPath() // secondary path skips email_metrics entirely

    await new MailerLiteService().createFinalissue(makeIssue(), 'main-group-1', true)

    const metricsInsert = supabase.insertCalls.find(c => 'mailerlite_issue_id' in c)
    const metricsUpdate = supabase.updateCalls.find(c => 'mailerlite_issue_id' in c)
    expect(metricsInsert).toBeUndefined()
    expect(metricsUpdate).toBeUndefined()
  })

  it('throws when /campaigns POST fails', async () => {
    supabase.responseQueue.push({ data: { slug: 'pub' }, error: null })
    mockedGetEmailSettings.mockResolvedValue({
      sender_name: 'X', from_email: 'x@y.com', review_group_id: 'rg', subject_line_emoji: '', mailerlite_group_id: 'mg',
    })
    mockedGetPublicationSettings.mockResolvedValue({})
    mockClient.post.mockRejectedValueOnce(new Error('upstream timeout'))

    await expect(
      new MailerLiteService().createFinalissue(makeIssue(), 'main-group-1', false)
    ).rejects.toThrow(/upstream timeout/)
  })
})

// ===========================================================================
// Send-guard documentation
// ===========================================================================
describe('Send-guard contract (documentation)', () => {
  it('locks current behavior: createFinalissue does NOT short-circuit when called twice — both calls hit the API', async () => {
    // Two full happy paths in sequence — same issue, called twice.
    setupCampaignHappyPath()
    supabase.responseQueue.push({ data: null, error: null }) // metrics.select #1
    supabase.responseQueue.push({ data: null, error: null }) // metrics.insert #1
    // 2nd call: re-queue publications + metrics responses
    supabase.responseQueue.push({ data: { slug: 'aiprodaily' }, error: null })
    supabase.responseQueue.push({ data: null, error: null }) // metrics.select #2
    supabase.responseQueue.push({ data: null, error: null }) // metrics.insert #2

    const svc = new MailerLiteService()
    await svc.createFinalissue(makeIssue(), 'main-group-1', false)
    await svc.createFinalissue(makeIssue(), 'main-group-1', false)

    // Both calls posted to /campaigns — duplicate campaigns. Any future fix
    // that adds an idempotency guard or status pre-check WILL break this
    // test, forcing a deliberate decision about the new contract.
    const campaignPosts = mockClient.post.mock.calls.filter(c => c[0] === '/campaigns')
    expect(campaignPosts).toHaveLength(2)
  })
})

// ===========================================================================
// importissueMetrics
// ===========================================================================
describe('MailerLiteService.importissueMetrics', () => {
  it('happy path: fetches campaign stats and updates email_metrics', async () => {
    // 1. email_metrics lookup → returns existing row
    supabase.responseQueue.push({
      data: { mailerlite_issue_id: 'ml-99' },
      error: null,
    })
    // 2. metrics update succeeds
    supabase.responseQueue.push({ data: null, error: null })

    mockClient.get.mockResolvedValueOnce({
      status: 200,
      data: {
        data: {
          stats: {
            sent: 1000,
            delivered: 980,
            opened: { count: 500, rate: { float: 50.0 } },
            clicked: { count: 100, rate: { float: 10.0 } },
            bounced: { count: 20 },
            unsubscribed: { count: 5 },
          },
        },
      },
    })

    const result = await new MailerLiteService().importissueMetrics('issue-uuid-1')

    expect(result).toMatchObject({
      sent_count: 1000,
      delivered_count: 980,
      opened_count: 500,
      clicked_count: 100,
      open_rate: 50.0,
      click_rate: 10.0,
    })
    expect(mockClient.get).toHaveBeenCalledWith('/campaigns/ml-99/reports')
  })

  it('returns skipped=true (does not throw) when no email_metrics row exists for the issue', async () => {
    supabase.responseQueue.push({ data: null, error: null })

    const result = await new MailerLiteService().importissueMetrics('issue-uuid-missing')

    expect(result).toMatchObject({ skipped: true })
    expect(mockClient.get).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// sendEventApprovalEmail / sendEventRejectionEmail
// ===========================================================================
describe('MailerLiteService transactional event emails', () => {
  const event = {
    title: 'AI Conf 2026',
    description: 'A conference',
    start_date: '2026-06-01T18:00:00Z',
    end_date: '2026-06-01T21:00:00Z',
    venue: 'Convention Center',
    address: '1 Main St',
    url: null,
    website: 'https://example.com',
    submitter_email: 'submitter@example.com',
    submitter_name: 'Jane Doe',
  }

  it('sendEventApprovalEmail returns {success:true} on POST success', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 200, data: { id: 'tx-1' } })

    const result = await new MailerLiteService().sendEventApprovalEmail(event)

    expect(result.success).toBe(true)
    expect(mockClient.post).toHaveBeenCalledWith(
      '/emails',
      expect.objectContaining({ to: 'submitter@example.com' })
    )
  })

  it('sendEventApprovalEmail returns {success:false, error} on failure (does NOT throw — contract differs from campaign methods)', async () => {
    mockClient.post.mockRejectedValueOnce(new Error('API down'))

    const result = await new MailerLiteService().sendEventApprovalEmail(event)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('sendEventRejectionEmail returns {success:false, error} on failure (does NOT throw)', async () => {
    mockClient.post.mockRejectedValueOnce(new Error('API down'))

    const result = await new MailerLiteService().sendEventRejectionEmail(
      {
        title: 't',
        description: 'd',
        start_date: '2026-06-01T18:00:00Z',
        submitter_email: 's@e.com',
        submitter_name: 'S',
      },
      'reason'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

// ===========================================================================
// updateSubscriberField
// ===========================================================================
describe('MailerLiteService.updateSubscriberField', () => {
  it('returns {success:true} on PUT 200', async () => {
    mockClient.put.mockResolvedValueOnce({ status: 200, data: {} })

    const result = await new MailerLiteService().updateSubscriberField(
      'user@example.com',
      'poll_responses',
      'A'
    )

    expect(result).toEqual({ success: true })
    expect(mockClient.put).toHaveBeenCalledWith(
      '/subscribers/user%40example.com',
      { fields: { poll_responses: 'A' } }
    )
  })

  it('returns {success:false} with "Subscriber not found" on 404', async () => {
    mockClient.put.mockRejectedValueOnce({ response: { status: 404 } })

    const result = await new MailerLiteService().updateSubscriberField('missing@example.com', 'f', 'v')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('returns {success:false} on other API errors (does NOT throw)', async () => {
    mockClient.put.mockRejectedValueOnce({ response: { status: 500, data: { message: 'server boom' } } })

    const result = await new MailerLiteService().updateSubscriberField('user@example.com', 'f', 'v')

    expect(result.success).toBe(false)
    expect(result.error).toBe('server boom')
  })
})
