import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { deleteTool } from '@/app/tools/actions'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/admin/delete' },
  async ({ request }) => {
    const { toolId } = await request.json()

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 })
    }

    const result = await deleteTool(toolId)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
