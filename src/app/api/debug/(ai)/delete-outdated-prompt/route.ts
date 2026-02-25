import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/delete-outdated-prompt' },
  async ({ logger }) => {
    logger.info('Deleting outdated ai_prompt_newsletter_writer from database...')

    const { error } = await supabaseAdmin
      .from('app_settings')
      .delete()
      .eq('key', 'ai_prompt_newsletter_writer')

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Deleted ai_prompt_newsletter_writer - will now use code fallback'
    })
  }
)
