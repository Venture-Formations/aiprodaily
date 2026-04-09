import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { rssCombinerIngestionWorkflow } from '@/lib/workflows/rss-combiner-ingestion-workflow'

/**
 * RSS Combiner Ingestion Workflow Endpoint
 * Starts a durable workflow where each step gets its own 800s timeout,
 * so long ingestion runs (many trades, heavy RSS fetching, image generation)
 * don't hit the single-function 600s API route limit.
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'workflows/rss-combiner-ingestion' },
  async () => {
    await start(rssCombinerIngestionWorkflow, [{ trigger: 'manual' }])

    return NextResponse.json({
      success: true,
      message: 'RSS combiner ingestion workflow started',
      timestamp: new Date().toISOString(),
    })
  }
)

export const maxDuration = 60
