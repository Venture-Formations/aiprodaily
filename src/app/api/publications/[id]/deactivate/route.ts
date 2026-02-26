import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const deactivateSchema = z.object({
  confirmSlug: z.string().min(1),
})

type DeactivateInput = z.infer<typeof deactivateSchema>

export const POST = withApiHandler<DeactivateInput>(
  { authTier: 'authenticated', inputSchema: deactivateSchema, logContext: 'publications/deactivate' },
  async ({ input, params, logger }) => {
    const publicationId = params.id

    // Look up publication
    const { data: pub, error: lookupError } = await supabaseAdmin
      .from('publications')
      .select('id, slug, is_active')
      .eq('id', publicationId)
      .single()

    if (lookupError || !pub) {
      return NextResponse.json({ error: 'Publication not found' }, { status: 404 })
    }

    if (!pub.is_active) {
      return NextResponse.json({ error: 'Publication is already deactivated' }, { status: 400 })
    }

    // Verify slug confirmation
    if (input.confirmSlug !== pub.slug) {
      return NextResponse.json(
        { error: 'Slug confirmation does not match' },
        { status: 400 }
      )
    }

    // Soft-delete: set is_active = false
    const { error: updateError } = await supabaseAdmin
      .from('publications')
      .update({ is_active: false })
      .eq('id', publicationId)

    if (updateError) {
      logger.error({ err: updateError }, 'Failed to deactivate publication')
      return NextResponse.json({ error: 'Failed to deactivate publication' }, { status: 500 })
    }

    logger.info({ publicationId, slug: pub.slug }, 'Publication deactivated')

    return NextResponse.json({ success: true })
  }
)
