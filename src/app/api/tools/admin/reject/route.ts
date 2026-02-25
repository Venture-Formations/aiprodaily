import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { rejectTool } from '@/app/tools/actions'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/admin/reject' },
  async ({ request }) => {
    const { toolId, reason } = await request.json()

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const result = await rejectTool(toolId, reason)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
