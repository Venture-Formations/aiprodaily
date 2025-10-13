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

    const scheduleDisplay = await ScheduleChecker.getScheduleDisplay()

    return NextResponse.json(scheduleDisplay)

  } catch (error) {
    console.error('Failed to get schedule display:', error)
    return NextResponse.json({
      error: 'Failed to get schedule display',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}