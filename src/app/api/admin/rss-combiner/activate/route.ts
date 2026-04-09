import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { activateStagedUpload } from '@/lib/rss-combiner'
import { rssCombinerIngestionWorkflow } from '@/lib/workflows/rss-combiner-ingestion-workflow'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/activate' },
  async ({ logger }) => {
    logger.info('Manual activation triggered')

    // Step 1: Activate staged data (staged → live table copy).
    // Typically takes ~30s for a full refresh. Runs synchronously.
    const activation = await activateStagedUpload()

    if (!activation.activated) {
      return NextResponse.json({
        activated: false,
        reason: activation.reason,
      })
    }

    // Step 2: Kick off the ingestion workflow (fire-and-forget).
    // Each step in the workflow gets its own 800s timeout, so the heavy work
    // (RSS fetching, image generation, secondary fetches) runs in the
    // background without being bounded by this route's 300s limit.
    try {
      await start(rssCombinerIngestionWorkflow, [{ trigger: 'manual' }])
      logger.info(
        { rowsCopied: activation.rowsCopied },
        'Activation complete, ingestion workflow started'
      )
    } catch (err) {
      logger.error(
        { err },
        'Activation completed but workflow failed to start'
      )
      return NextResponse.json({
        activated: true,
        rowsCopied: activation.rowsCopied,
        workflowStarted: false,
        workflowError: err instanceof Error ? err.message : 'Unknown error',
      })
    }

    return NextResponse.json({
      activated: true,
      rowsCopied: activation.rowsCopied,
      workflowStarted: true,
    })
  }
)

// Only the staged→live copy runs synchronously here; ingestion is offloaded
// to a durable workflow. 300s is comfortable for the copy alone.
export const maxDuration = 300
