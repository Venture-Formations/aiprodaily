import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600

/**
 * Check OpenAI posts in campaign for full_article_text
 *
 * Usage: GET /api/debug/check-openai-posts?campaign_id=XXX
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaign_id')

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
  }

  try {
    // Get all posts with "OpenAI" in title
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url')
      .eq('campaign_id', campaignId)
      .ilike('title', '%OpenAI%')
      .order('title')

    if (error) {
      throw error
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No OpenAI posts found in this campaign',
        campaign_id: campaignId
      })
    }

    // Analyze each post
    const analysis = posts.map(post => ({
      title: post.title,
      has_full_text: !!post.full_article_text,
      full_text_length: post.full_article_text?.length || 0,
      description_length: post.description?.length || 0,
      source_url: post.source_url,
      full_text_preview: post.full_article_text
        ? post.full_article_text.substring(0, 200) + '...'
        : 'NO FULL TEXT'
    }))

    const withFullText = analysis.filter(a => a.has_full_text).length
    const withoutFullText = analysis.length - withFullText

    return NextResponse.json({
      status: 'success',
      campaign_id: campaignId,
      total_openai_posts: posts.length,
      with_full_text: withFullText,
      without_full_text: withoutFullText,
      success_rate: `${Math.round((withFullText / posts.length) * 100)}%`,
      posts: analysis
    })

  } catch (error) {
    console.error('[CHECK-OPENAI] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
