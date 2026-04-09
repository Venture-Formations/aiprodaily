import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { activateStagedUpload, runIngestion } from '@/lib/rss-combiner'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/activate' },
  async ({ logger }) => {
    logger.info('Manual activation triggered')

    const activation = await activateStagedUpload()

    if (!activation.activated) {
      return NextResponse.json({
        activated: false,
        reason: activation.reason,
      })
    }

    // Run ingestion with the newly activated trades
    const ingestion = await runIngestion()

    logger.info(
      { rowsCopied: activation.rowsCopied, articlesStored: ingestion.articlesStored },
      'Manual activation + ingestion complete'
    )

    return NextResponse.json({
      activated: true,
      rowsCopied: activation.rowsCopied,
      ingestion,
    })
  }
)

// Extended from 300s to 600s (project max per vercel.json) because this runs
// full ingestion which processes ~70 trades with RSS fetching, image generation,
// and secondary fetches.
export const maxDuration = 600
