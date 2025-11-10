import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateDebugAuth } from '@/lib/debug-auth'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('=== ACTIVATING TOP ARTICLES ===')

    // Get latest campaign or specified campaign ID
    const body = await request.json().catch(() => ({}))
    let campaignId = body.campaignId

    if (!campaignId) {
      const { data: campaign, error } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id, date, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !campaign) {
        return NextResponse.json({
          success: false,
          error: 'No campaign found'
        }, { status: 404 })
      }

      campaignId = campaign.id
      console.log('Using latest campaign:', campaignId)
    }

    // Get all articles for this campaign with ratings
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select(`
        id,
        headline,
        is_active,
        rss_post:rss_posts(
          post_rating:post_ratings(total_score)
        )
      `)
      .eq('campaign_id', campaignId)

    if (articlesError || !articles) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch articles',
        details: articlesError?.message
      }, { status: 500 })
    }

    console.log(`Found ${articles.length} articles for campaign ${campaignId}`)

    // Sort articles by score
    const sortedArticles = articles
      .map(article => ({
        id: article.id,
        headline: article.headline,
        score: (article.rss_post as any)?.post_rating?.[0]?.total_score || 0,
        currentlyActive: article.is_active
      }))
      .sort((a, b) => b.score - a.score)

    const top5ArticleIds = sortedArticles.slice(0, 5).map(a => a.id)
    const remainingArticleIds = sortedArticles.slice(5).map(a => a.id)

    console.log(`Setting ${top5ArticleIds.length} articles as active, ${remainingArticleIds.length} as inactive`)

    // Set top 5 as active
    if (top5ArticleIds.length > 0) {
      const { error: activateError } = await supabaseAdmin
        .from('articles')
        .update({ is_active: true })
        .in('id', top5ArticleIds)

      if (activateError) {
        console.error('Error activating articles:', activateError)
        return NextResponse.json({
          success: false,
          error: 'Failed to activate top articles',
          details: activateError.message
        }, { status: 500 })
      }
    }

    // Set remaining as inactive
    if (remainingArticleIds.length > 0) {
      const { error: deactivateError } = await supabaseAdmin
        .from('articles')
        .update({ is_active: false })
        .in('id', remainingArticleIds)

      if (deactivateError) {
        console.error('Error deactivating articles:', deactivateError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Articles activated successfully',
      campaignId,
      totalArticles: articles.length,
      activatedArticles: top5ArticleIds.length,
      deactivatedArticles: remainingArticleIds.length,
      topArticles: sortedArticles.slice(0, 5).map(a => ({
        id: a.id,
        headline: a.headline,
        score: a.score,
        wasActive: a.currentlyActive
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Article activation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}