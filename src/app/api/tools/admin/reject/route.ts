import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rejectTool } from '@/app/tools/actions'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
