import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * List all AI prompts in the database
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/list-ai-prompts' },
  async () => {
    const { data: prompts, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, description')
      .like('key', 'ai_prompt%')
      .order('key')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      count: prompts?.length || 0,
      prompts: prompts || []
    })
  }
)
