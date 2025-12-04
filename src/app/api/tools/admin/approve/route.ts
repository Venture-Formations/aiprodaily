import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { approveTool } from '@/app/tools/actions'

export async function POST(request: NextRequest) {
  // Check if staging environment (bypass auth)
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  if (!isStaging) {
    // Check admin authentication in production
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { toolId } = await request.json()

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 })
  }

  const result = await approveTool(toolId)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
