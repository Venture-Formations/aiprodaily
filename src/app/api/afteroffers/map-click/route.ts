import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

const inputSchema = z.object({
  email: z.string().email(),
  click_id: z.string().min(1),
  publication_id: z.string().uuid().optional(),
})

export const POST = withApiHandler(
  { authTier: 'public', inputSchema, logContext: 'afteroffers/map-click' },
  async ({ input, logger }) => {
    const { email, click_id, publication_id } = input

    // Fall back to env default when the client didn't send publication_id (older
    // cached bundles, or contexts where the publication isn't known to the form).
    const effectivePublicationId = publication_id || PUBLICATION_ID

    const { error } = await supabaseAdmin
      .from('afteroffers_click_mappings')
      .upsert(
        {
          publication_id: effectivePublicationId,
          click_id,
          email,
        },
        { onConflict: 'publication_id,click_id' }
      )

    if (error) {
      logger.error({ err: error, click_id }, 'Failed to store click mapping')
      throw new Error(`Database error: ${error.message}`)
    }

    logger.info({ click_id }, 'Stored AfterOffers click mapping')
    return NextResponse.json({ success: true })
  }
)
