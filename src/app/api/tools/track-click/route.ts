import { NextRequest, NextResponse } from 'next/server'
import { incrementToolClicks } from '@/lib/directory'

export async function POST(request: NextRequest) {
  try {
    const { toolId } = await request.json()

    if (!toolId || typeof toolId !== 'string') {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      )
    }

    await incrementToolClicks(toolId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error tracking tool click:', error)
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    )
  }
}
