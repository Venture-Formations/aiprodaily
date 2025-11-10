import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GitHubImageStorage } from '@/lib/github-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log('=== MANUAL IMAGE PROCESSING DEBUG ===')
    console.log('Campaign ID:', campaignId)

    const githubStorage = new GitHubImageStorage()

    // Get active articles with their RSS post image URLs
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select(`
        id,
        rss_post:rss_posts(
          id,
          image_url,
          title
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    if (error || !articles) {
      return NextResponse.json({
        error: 'Failed to fetch articles',
        details: error?.message
      }, { status: 500 })
    }

    console.log(`Found ${articles.length} active articles to process`)

    const results = []

    // Process images for each article
    for (const article of articles) {
      try {
        const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post

        if (!rssPost?.image_url) {
          results.push({
            articleId: article.id,
            status: 'skipped',
            reason: 'No image URL'
          })
          continue
        }

        const originalImageUrl = rssPost.image_url
        console.log(`Processing image for article ${article.id}: ${originalImageUrl}`)

        // Skip if already a GitHub URL
        if (originalImageUrl.includes('github.com') || originalImageUrl.includes('githubusercontent.com')) {
          results.push({
            articleId: article.id,
            status: 'skipped',
            reason: 'Already GitHub URL',
            currentUrl: originalImageUrl
          })
          continue
        }

        // Upload image to GitHub
        const githubUrl = await githubStorage.uploadImage(originalImageUrl, rssPost.title)

        if (githubUrl) {
          // Update the RSS post with GitHub URL
          await supabaseAdmin
            .from('rss_posts')
            .update({ image_url: githubUrl })
            .eq('id', rssPost.id)

          results.push({
            articleId: article.id,
            status: 'success',
            originalUrl: originalImageUrl,
            githubUrl: githubUrl
          })
        } else {
          results.push({
            articleId: article.id,
            status: 'failed',
            originalUrl: originalImageUrl,
            reason: 'Upload returned null'
          })
        }

      } catch (error) {
        results.push({
          articleId: article.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      debug: 'Manual Image Processing',
      campaignId,
      articlesFound: articles.length,
      results,
      summary: {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        errors: results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual image processing error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to process images'
    }, { status: 500 })
  }
}