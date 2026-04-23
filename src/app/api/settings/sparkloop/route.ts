import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getPublicationSetting, updatePublicationSetting } from '@/lib/publication-settings'

/**
 * GET /api/settings/sparkloop?publication_id=X
 *
 * Returns SparkLoop settings for a publication.
 * Never exposes actual API key or webhook secret values.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/sparkloop' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    const [upscribeId, webhookSecret, afteroffersFormId] = await Promise.all([
      getPublicationSetting(publicationId, 'sparkloop_upscribe_id'),
      getPublicationSetting(publicationId, 'sparkloop_webhook_secret'),
      getPublicationSetting(publicationId, 'afteroffers_form_id'),
    ])

    return NextResponse.json({
      // SparkLoop API key is sourced from the SPARKLOOP_API_KEY env var — shared across publications.
      hasApiKey: !!process.env.SPARKLOOP_API_KEY,
      upscribeId: upscribeId || '',
      hasWebhookSecret: !!webhookSecret,
      afteroffersFormId: afteroffersFormId || '',
    })
  }
)

/**
 * POST /api/settings/sparkloop?publication_id=X
 *
 * Save SparkLoop credentials for a publication.
 * Only updates fields that have non-empty values (to avoid clearing existing secrets).
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/sparkloop' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    const body = await request.json()
    const results: string[] = []

    if (body.upscribeId !== undefined) {
      const { error } = await updatePublicationSetting(publicationId, 'sparkloop_upscribe_id', body.upscribeId)
      if (error) throw new Error(`Failed to save Upscribe ID: ${error}`)
      results.push('Upscribe ID updated')
    }

    if (body.webhookSecret) {
      const { error } = await updatePublicationSetting(publicationId, 'sparkloop_webhook_secret', body.webhookSecret)
      if (error) throw new Error(`Failed to save webhook secret: ${error}`)
      results.push('Webhook secret updated')
    }

    if (body.afteroffersFormId !== undefined) {
      const { error } = await updatePublicationSetting(publicationId, 'afteroffers_form_id', body.afteroffersFormId)
      if (error) throw new Error(`Failed to save AfterOffers form ID: ${error}`)
      results.push('AfterOffers form ID updated')
    }

    return NextResponse.json({
      success: true,
      message: results.length > 0 ? results.join(', ') : 'No changes',
    })
  }
)
