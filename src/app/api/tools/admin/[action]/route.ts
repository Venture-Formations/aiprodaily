import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import {
  approveTool,
  rejectTool,
  deleteTool,
  toggleFeatured,
  updateTool,
} from '@/app/tools/actions'

const VALID_ACTIONS = ['approve', 'reject', 'delete', 'toggle-featured', 'update'] as const
type Action = (typeof VALID_ACTIONS)[number]

const toolIdSchema = z.object({ toolId: z.string().min(1) })
const rejectSchema = z.object({ toolId: z.string().min(1), reason: z.string().min(1) })
const toggleFeaturedSchema = z.object({ toolId: z.string().min(1), isFeatured: z.boolean() })
const updateSchema = z.object({
  toolId: z.string().min(1),
  data: z.any(),
  listingImageFileName: z.string().optional(),
  logoImageFileName: z.string().optional(),
})

function badRequest(error: z.ZodError) {
  const message = error.issues.map((i) => i.message).join(', ') || 'Invalid request'
  return NextResponse.json({ error: message }, { status: 400 })
}

function actionResult(result: { error?: string | null }) {
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/admin' },
  async ({ request, session, params, logger }) => {
    const action = params.action

    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      logger.warn({ action }, 'Unknown tools/admin action')
      return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
    }

    logger.info({ action }, 'tools/admin action')
    const body = await request.json()

    switch (action as Action) {
      case 'approve': {
        const parsed = toolIdSchema.safeParse(body)
        if (!parsed.success) return badRequest(parsed.error)
        return actionResult(await approveTool(parsed.data.toolId, session.user.email ?? undefined))
      }
      case 'reject': {
        const parsed = rejectSchema.safeParse(body)
        if (!parsed.success) return badRequest(parsed.error)
        return actionResult(await rejectTool(parsed.data.toolId, parsed.data.reason))
      }
      case 'delete': {
        const parsed = toolIdSchema.safeParse(body)
        if (!parsed.success) return badRequest(parsed.error)
        return actionResult(await deleteTool(parsed.data.toolId))
      }
      case 'toggle-featured': {
        const parsed = toggleFeaturedSchema.safeParse(body)
        if (!parsed.success) return badRequest(parsed.error)
        return actionResult(await toggleFeatured(parsed.data.toolId, parsed.data.isFeatured))
      }
      case 'update': {
        const parsed = updateSchema.safeParse(body)
        if (!parsed.success) return badRequest(parsed.error)
        return actionResult(
          await updateTool(
            parsed.data.toolId,
            parsed.data.data,
            parsed.data.listingImageFileName,
            parsed.data.logoImageFileName,
          ),
        )
      }
    }
  },
)
