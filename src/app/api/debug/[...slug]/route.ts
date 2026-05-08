import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { isProduction, isStaging } from '@/lib/env-guard'

// Import handler registries from each group
import { handlers as aiHandlers } from '../handlers/ai'
import { handlers as campaignHandlers } from '../handlers/campaign'
import { handlers as checksHandlers } from '../handlers/checks'
import { handlers as integrationsHandlers } from '../handlers/integrations'
import { handlers as maintenanceHandlers } from '../handlers/maintenance'
import { handlers as mediaHandlers } from '../handlers/media'
import { handlers as rssHandlers } from '../handlers/rss'
import { handlers as testsHandlers } from '../handlers/tests'
import { handlers as rootHandlers } from '../handlers/root'

export const maxDuration = 600

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

// Build a flat lookup: route-name -> { GET?, POST?, DELETE? }
// Route groups (ai), (campaign), etc. don't appear in the URL,
// so all routes are accessed as /api/debug/<route-name>
const allHandlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler; DELETE?: DebugHandler; [key: string]: unknown }> = {
  ...aiHandlers,
  ...campaignHandlers,
  ...checksHandlers,
  ...integrationsHandlers,
  ...maintenanceHandlers,
  ...mediaHandlers,
  ...rssHandlers,
  ...testsHandlers,
  ...rootHandlers,
}

function extractRouteName(request: Request): string {
  const url = new URL(request.url)
  // URL is like /api/debug/check-ai-prompts or /api/debug/some-route
  // Extract everything after /api/debug/
  const match = url.pathname.match(/\/api\/debug\/(.+)/)
  return match?.[1] || ''
}

async function handleRequest(
  context: ApiHandlerContext,
  method: 'GET' | 'POST' | 'DELETE'
): Promise<NextResponse> {
  const routeName = extractRouteName(context.request)

  const entry = allHandlers[routeName]
  if (!entry) {
    return NextResponse.json(
      { error: 'Debug route not found', route: routeName },
      { status: 404 }
    )
  }

  const handler = entry[method]
  if (typeof handler !== 'function') {
    return NextResponse.json(
      { error: `Method ${method} not allowed for debug route: ${routeName}` },
      { status: 405 }
    )
  }

  return handler(context)
}

// Production gate runs BEFORE withApiHandler so unauthenticated prod requests
// don't get a 401 (which would reveal the route exists). Staging Vercel
// project (STAGING=true override) keeps debug routes live, as does Preview
// and local dev.
const isProdGated = (): boolean => isProduction() && !isStaging()

const handleGET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/catch-all' },
  async (context) => handleRequest(context, 'GET')
)

const handlePOST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/catch-all' },
  async (context) => handleRequest(context, 'POST')
)

const handleDELETE = withApiHandler(
  { authTier: 'admin', logContext: 'debug/catch-all' },
  async (context) => handleRequest(context, 'DELETE')
)

type RouteCtx = { params: Promise<Record<string, string>> }

export const GET = async (req: NextRequest, ctx: RouteCtx): Promise<NextResponse> => {
  if (isProdGated()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return handleGET(req, ctx)
}

export const POST = async (req: NextRequest, ctx: RouteCtx): Promise<NextResponse> => {
  if (isProdGated()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return handlePOST(req, ctx)
}

export const DELETE = async (req: NextRequest, ctx: RouteCtx): Promise<NextResponse> => {
  if (isProdGated()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return handleDELETE(req, ctx)
}
