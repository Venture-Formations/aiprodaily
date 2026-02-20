import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
    }

    console.log('=== MANUAL IMAGE PROCESSING DEBUG ===')
    console.log('issue ID:', issueId)

    const imageStorage = new SupabaseImageStorage()

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
      .eq('issue_id', issueId)
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

        // Skip if already hosted on Supabase
        let isHosted = false
        try { const h = new URL(originalImageUrl).hostname.toLowerCase(); isHosted = h.endsWith('.supabase.co') || h === 'img.aiprodaily.com' } catch {}
        if (isHosted) {
          results.push({
            articleId: article.id,
            status: 'skipped',
            reason: 'Already hosted on Supabase',
            currentUrl: originalImageUrl
          })
          continue
        }

        // Upload image to Supabase (optimized via Tinify)
        const hostedUrl = await imageStorage.uploadImage(originalImageUrl, rssPost.title)

        if (hostedUrl) {
          await supabaseAdmin
            .from('rss_posts')
            .update({ image_url: hostedUrl })
            .eq('id', rssPost.id)

          results.push({
            articleId: article.id,
            status: 'success',
            originalUrl: originalImageUrl,
            hostedUrl
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
      issueId,
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