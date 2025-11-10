import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
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

  } catch (error) {
    console.error('Check AI prompts error:', error)
    return NextResponse.json({
      error: 'Failed to check AI prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
