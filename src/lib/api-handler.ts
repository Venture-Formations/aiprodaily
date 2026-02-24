import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createLogger, type Logger } from '@/lib/logger'
import type { AuthTier } from '@/lib/auth-tiers'

/**
 * Standard API route wrapper.
 * Centralizes: auth checking, Zod validation, error formatting,
 * publication_id scoping, and structured logging.
 */

export interface ApiHandlerConfig<TInput = unknown> {
  /** Auth tier required for this route */
  authTier: AuthTier
  /** Optional Zod schema for request body/params validation */
  inputSchema?: z.ZodType<TInput>
  /** If true, extracts publication_id from input and injects into handler context */
  requirePublicationId?: boolean
  /** Logger context name (defaults to route path) */
  logContext?: string
}

export interface ApiHandlerContext<TInput = unknown> {
  /** NextAuth session (null for public/system routes) */
  session: any | null
  /** Validated input from Zod schema */
  input: TInput
  /** Publication ID if requirePublicationId is true */
  publicationId: string | null
  /** Structured logger bound to this request */
  logger: Logger
  /** The original request for accessing headers, params, etc. */
  request: NextRequest
}

type ApiHandler<TInput = unknown> = (
  context: ApiHandlerContext<TInput>
) => Promise<NextResponse>

/**
 * Wraps an API route handler with standardized auth, validation, and error handling.
 *
 * Usage:
 *   export const POST = withApiHandler(
 *     { authTier: 'authenticated', inputSchema: mySchema },
 *     async ({ session, input, logger }) => {
 *       // ... your logic
 *       return NextResponse.json({ success: true })
 *     }
 *   )
 */
export function withApiHandler<TInput = unknown>(
  config: ApiHandlerConfig<TInput>,
  handler: ApiHandler<TInput>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const logger = createLogger({
      cronName: config.logContext,
    })

    try {
      // --- Auth check ---
      let session: any | null = null

      if (config.authTier === 'system') {
        // System routes: check for CRON_SECRET bearer token or URL param
        const authHeader = request.headers.get('Authorization')
        const searchParams = new URL(request.url).searchParams
        const secretParam = searchParams.get('secret')

        const bearerValid = authHeader === `Bearer ${process.env.CRON_SECRET}`
        const paramValid = secretParam === process.env.CRON_SECRET
        // Vercel cron calls come without auth — allow if no secret param present
        const isVercelCron = !secretParam && !searchParams.has('secret') && !authHeader

        if (!bearerValid && !paramValid && !isVercelCron) {
          logger.warn('Unauthorized system route access attempt')
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      } else if (config.authTier === 'authenticated' || config.authTier === 'admin') {
        session = await getServerSession(authOptions)

        if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (config.authTier === 'admin' && session.user?.role !== 'admin') {
          logger.warn({ email: session.user?.email }, 'Forbidden: admin tier required')
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      // 'public' tier: no auth check needed

      // --- Input validation ---
      let input: TInput = {} as TInput

      if (config.inputSchema) {
        let rawInput: unknown

        const contentType = request.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            rawInput = await request.json()
          } catch {
            return NextResponse.json(
              { error: 'Invalid JSON body' },
              { status: 400 }
            )
          }
        } else {
          // For GET requests, use search params
          const params = Object.fromEntries(new URL(request.url).searchParams)
          rawInput = params
        }

        const result = config.inputSchema.safeParse(rawInput)
        if (!result.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: result.error.issues.map(i => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            },
            { status: 400 }
          )
        }
        input = result.data
      }

      // --- Publication ID extraction ---
      let publicationId: string | null = null
      if (config.requirePublicationId) {
        publicationId = (input as any)?.publicationId || (input as any)?.publication_id || null
        if (!publicationId) {
          return NextResponse.json(
            { error: 'publication_id is required' },
            { status: 400 }
          )
        }
        // Bind to logger for downstream queries
        ;(logger as any).publicationId = publicationId
      }

      // --- Execute handler ---
      return await handler({
        session,
        input,
        publicationId,
        logger,
        request,
      })
    } catch (error) {
      logger.error({ err: error }, 'Unhandled API error')
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
}
