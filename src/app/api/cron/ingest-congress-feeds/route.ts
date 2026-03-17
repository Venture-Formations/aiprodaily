import { NextRequest, NextResponse } from 'next/server'
import { runIngestion } from '@/lib/rss-combiner'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runIngestion()
    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CRON] Congress feed ingestion failed:', error)
    return NextResponse.json(
      { error: 'Ingestion failed', message },
      { status: 500 }
    )
  }
}
