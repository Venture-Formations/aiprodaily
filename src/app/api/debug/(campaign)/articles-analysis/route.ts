import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/articles-analysis' },
  async ({ logger }) => {
    // Get all active articles with their headlines and content
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, headline, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      count: articles?.length || 0,
      articles: articles || []
    })
  }
)
