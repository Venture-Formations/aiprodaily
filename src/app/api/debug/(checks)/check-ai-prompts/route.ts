import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-ai-prompts' },
  async ({ logger }) => {
    // Get all AI prompts from database
    const { data: prompts, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'ai_prompt_%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      total_prompts: prompts?.length || 0,
      prompts: prompts?.map(p => ({
        key: p.key,
        has_value: !!p.value,
        value_length: p.value?.length || 0,
        has_title_placeholder: p.value?.includes('{{title}}'),
        has_description_placeholder: p.value?.includes('{{description}}'),
        preview: p.value?.substring(0, 200) + '...'
      }))
    })
  }
)
