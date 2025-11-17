import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the active publication
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Fetch all AI prompts from publication_settings
    const { data: prompts, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value, description')
      .eq('publication_id', newsletter.id)
      .like('key', 'ai_prompt_%')
      .order('key', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Analyze each prompt
    const analysis = prompts?.map(p => ({
      key: p.key,
      description: p.description,
      value_type: typeof p.value,
      value_length: p.value?.length || 0,
      value_is_null: p.value === null,
      value_is_empty: p.value === '',
      value_starts_with_quote: p.value?.startsWith('"') || false,
      value_ends_with_quote: p.value?.endsWith('"') || false,
      value_preview: p.value ? p.value.substring(0, 100) + (p.value.length > 100 ? '...' : '') : '[NULL]'
    })) || []

    return NextResponse.json({
      publication: newsletter.name,
      publication_id: newsletter.id,
      total_prompts: prompts?.length || 0,
      prompts: analysis
    })

  } catch (error) {
    console.error('Error checking AI prompts:', error)
    return NextResponse.json({
      error: 'Failed to check AI prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
