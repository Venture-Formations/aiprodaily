import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { runIngestion } from '@/lib/rss-combiner'

export const maxDuration = 300

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ingest' },
  async () => {
    const result = await runIngestion()
    return NextResponse.json({ success: true, ...result })
  }
)
