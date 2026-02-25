import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { ScheduleChecker } from '@/lib/schedule-checker'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/schedule-display' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publication_id = searchParams.get('publication_id')

    if (!publication_id) {
      return NextResponse.json({
        error: 'publication_id query parameter is required'
      }, { status: 400 })
    }

    const scheduleDisplay = await ScheduleChecker.getScheduleDisplay(publication_id)

    return NextResponse.json(scheduleDisplay)
  }
)
