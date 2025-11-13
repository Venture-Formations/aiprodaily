import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ScheduleChecker } from '@/lib/schedule-checker'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publication_id = searchParams.get('publication_id')

    if (!publication_id) {
      return NextResponse.json({
        error: 'publication_id query parameter is required'
      }, { status: 400 })
    }

    const scheduleDisplay = await ScheduleChecker.getScheduleDisplay(publication_id)

    return NextResponse.json(scheduleDisplay)

  } catch (error) {
    console.error('Failed to get schedule display:', error)
    return NextResponse.json({
      error: 'Failed to get schedule display',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}