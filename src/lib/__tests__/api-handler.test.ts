import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '../api-handler'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-correlation-id',
  }
  return {
    createLogger: vi.fn(() => mockLogger),
    __mockLogger: mockLogger,
  }
})

import { getServerSession } from 'next-auth'

const mockedGetSession = vi.mocked(getServerSession)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(
  url = 'https://example.com/api/test',
  options: {
    method?: string
    headers?: Record<string, string>
    body?: any
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options
  const allHeaders: Record<string, string> = { ...headers }
  if (body) {
    allHeaders['content-type'] = 'application/json'
  }
  return new NextRequest(url, {
    method,
    headers: allHeaders,
    body: body ? JSON.stringify(body) : undefined,
  } as any)
}

function makeRouteCtx(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret-123'
})

// ---------------------------------------------------------------------------
// Auth: public tier
// ---------------------------------------------------------------------------
describe('withApiHandler — public tier', () => {
  it('allows unauthenticated access', async () => {
    const handler = withApiHandler(
      { authTier: 'public' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Auth: system tier
// ---------------------------------------------------------------------------
describe('withApiHandler — system tier', () => {
  it('accepts valid Bearer token', async () => {
    const handler = withApiHandler(
      { authTier: 'system' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        headers: { Authorization: 'Bearer test-secret-123' },
      }),
      makeRouteCtx()
    )

    expect(res.status).toBe(200)
  })

  it('accepts valid secret query param', async () => {
    const handler = withApiHandler(
      { authTier: 'system' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test?secret=test-secret-123'),
      makeRouteCtx()
    )

    expect(res.status).toBe(200)
  })

  it('allows Vercel cron calls (no auth headers at all)', async () => {
    const handler = withApiHandler(
      { authTier: 'system' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(200)
  })

  it('rejects wrong secret', async () => {
    const handler = withApiHandler(
      { authTier: 'system' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test?secret=wrong-secret'),
      makeRouteCtx()
    )

    expect(res.status).toBe(401)
  })

  it('rejects wrong Bearer token', async () => {
    const handler = withApiHandler(
      { authTier: 'system' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        headers: { Authorization: 'Bearer wrong' },
      }),
      makeRouteCtx()
    )

    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Auth: authenticated tier
// ---------------------------------------------------------------------------
describe('withApiHandler — authenticated tier', () => {
  it('allows valid session', async () => {
    mockedGetSession.mockResolvedValue({ user: { email: 'a@b.com' } })

    const handler = withApiHandler(
      { authTier: 'authenticated' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(200)
  })

  it('rejects when no session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const handler = withApiHandler(
      { authTier: 'authenticated' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Auth: admin tier
// ---------------------------------------------------------------------------
describe('withApiHandler — admin tier', () => {
  it('allows admin session', async () => {
    mockedGetSession.mockResolvedValue({ user: { email: 'a@b.com', role: 'admin' } })

    const handler = withApiHandler(
      { authTier: 'admin' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(200)
  })

  it('returns 403 for non-admin session', async () => {
    mockedGetSession.mockResolvedValue({ user: { email: 'a@b.com', role: 'user' } })

    const handler = withApiHandler(
      { authTier: 'admin' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(403)
  })

  it('returns 401 for missing session', async () => {
    mockedGetSession.mockResolvedValue(null)

    const handler = withApiHandler(
      { authTier: 'admin' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe('withApiHandler — input validation', () => {
  const schema = z.object({ name: z.string() })

  it('passes valid JSON body to handler', async () => {
    const handler = withApiHandler(
      { authTier: 'public', inputSchema: schema },
      async ({ input }) => NextResponse.json({ received: input })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        method: 'POST',
        body: { name: 'test' },
      }),
      makeRouteCtx()
    )

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.received.name).toBe('test')
  })

  it('returns 400 for invalid body', async () => {
    const handler = withApiHandler(
      { authTier: 'public', inputSchema: schema },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        method: 'POST',
        body: { name: 123 },
      }),
      makeRouteCtx()
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('uses search params for GET requests with schema', async () => {
    const getSchema = z.object({ q: z.string() })

    const handler = withApiHandler(
      { authTier: 'public', inputSchema: getSchema },
      async ({ input }) => NextResponse.json({ query: input })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test?q=hello'),
      makeRouteCtx()
    )

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.query.q).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('withApiHandler — error handling', () => {
  it('returns 500 when handler throws', async () => {
    const handler = withApiHandler(
      { authTier: 'public' },
      async () => {
        throw new Error('boom')
      }
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).toBe('Internal server error')
    expect(body.message).toBe('boom')
  })

  it('sets correlation ID on error response', async () => {
    const handler = withApiHandler(
      { authTier: 'public' },
      async () => {
        throw new Error('fail')
      }
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
  })
})

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------
describe('withApiHandler — response metadata', () => {
  it('sets correlation ID on success response', async () => {
    const handler = withApiHandler(
      { authTier: 'public' },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(makeRequest(), makeRouteCtx())
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
  })

  it('passes request and params to handler context', async () => {
    let capturedParams: Record<string, string> = {}

    const handler = withApiHandler(
      { authTier: 'public' },
      async ({ params, request }) => {
        capturedParams = params
        return NextResponse.json({ url: request.url })
      }
    )

    await handler(makeRequest(), makeRouteCtx({ id: '42' }))
    expect(capturedParams.id).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// publication_id extraction
// ---------------------------------------------------------------------------
describe('withApiHandler — requirePublicationId', () => {
  const schema = z.object({ publication_id: z.string() })

  it('extracts publication_id from input', async () => {
    let capturedPubId: string | null = null

    const handler = withApiHandler(
      { authTier: 'public', inputSchema: schema, requirePublicationId: true },
      async ({ publicationId }) => {
        capturedPubId = publicationId
        return NextResponse.json({ ok: true })
      }
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        method: 'POST',
        body: { publication_id: 'pub-123' },
      }),
      makeRouteCtx()
    )

    expect(res.status).toBe(200)
    expect(capturedPubId).toBe('pub-123')
  })

  it('returns 400 when publication_id is missing', async () => {
    const emptySchema = z.object({})

    const handler = withApiHandler(
      { authTier: 'public', inputSchema: emptySchema, requirePublicationId: true },
      async () => NextResponse.json({ ok: true })
    )

    const res = await handler(
      makeRequest('https://example.com/api/test', {
        method: 'POST',
        body: {},
      }),
      makeRouteCtx()
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('publication_id is required')
  })
})
