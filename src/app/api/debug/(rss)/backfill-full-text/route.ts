import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ArticleExtractor } from '@/lib/article-extractor'

export const maxDuration = 600 // 10 minutes for backfill

/**
 * Backfill missing full_article_text using Jina AI
 *
 * Usage: GET /api/debug/backfill-full-text?issueId=XXX&dry_run=true
 *
 * This will:
 * 1. Find all posts with no/empty full_article_text
 * 2. Try to extract using ArticleExtractor (includes Jina AI fallback)
 * 3. Update database with successful extractions
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(rss)/backfill-full-text' },
  async ({ request, logger }) => {
  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issue_id')
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true
  const limit = parseInt(searchParams.get('limit') || '20') // Max posts to process

  if (!issueId) {
    return NextResponse.json({ error: 'issueId required' }, { status: 400 })
  }

  try {
    console.log(`[BACKFILL] ${dryRun ? 'DRY RUN:' : ''} Starting backfill for issue ${issueId}`)

    // Find posts with no full_article_text
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, source_url, full_article_text')
      .eq('issue_id', issueId)
      .or('full_article_text.is.null,full_article_text.eq.')
      .limit(limit)

    if (error) {
      console.error('[BACKFILL] Query error:', error)
      throw error
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No posts need backfilling',
        issue_id: issueId,
        posts_found: 0
      })
    }

    console.log(`[BACKFILL] Found ${posts.length} posts without full_article_text`)

    // Extract using ArticleExtractor (with Jina AI fallback)
    const extractor = new ArticleExtractor()
    const results: Array<{
      id: string
      title: string
      source_url: string
      success: boolean
      method: 'readability' | 'jina' | 'failed'
      full_text_length?: number
      error?: string
    }> = []

    let successCount = 0
    let failedCount = 0

    // Process sequentially to avoid overwhelming Jina API
    for (const post of posts) {
      console.log(`[BACKFILL] Processing: ${post.title.substring(0, 60)}...`)

      try {
        const result = await extractor.extractArticle(post.source_url)

        if (result.success && result.fullText) {
          successCount++

          // Update database (if not dry run)
          if (!dryRun) {
            const { error: updateError } = await supabaseAdmin
              .from('rss_posts')
              .update({ full_article_text: result.fullText })
              .eq('id', post.id)

            if (updateError) {
              console.error(`[BACKFILL] Failed to update ${post.id}:`, updateError)
              results.push({
                id: post.id,
                title: post.title,
                source_url: post.source_url,
                success: false,
                method: 'failed',
                error: `Database update failed: ${updateError.message}`
              })
              continue
            }

            console.log(`[BACKFILL] ✓ Updated ${post.id} with ${result.fullText.length} chars`)
          }

          // Determine which method succeeded by checking logs
          // (Jina logs "[Extract] ✓ Jina AI succeeded", Readability logs "[Extract] ✓ Readability succeeded")
          const method = result.fullText.includes('Jina') ? 'jina' : 'readability'

          results.push({
            id: post.id,
            title: post.title,
            source_url: post.source_url,
            success: true,
            method,
            full_text_length: result.fullText.length
          })

        } else {
          failedCount++
          results.push({
            id: post.id,
            title: post.title,
            source_url: post.source_url,
            success: false,
            method: 'failed',
            error: result.error || 'Unknown error'
          })
          console.log(`[BACKFILL] ✗ Failed: ${result.error}`)
        }

        // Small delay between requests to be polite
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        failedCount++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[BACKFILL] Exception for ${post.id}:`, errorMsg)
        results.push({
          id: post.id,
          title: post.title,
          source_url: post.source_url,
          success: false,
          method: 'failed',
          error: errorMsg
        })
      }
    }

    const successRate = Math.round((successCount / posts.length) * 100)

    console.log(`[BACKFILL] Complete: ${successCount} succeeded, ${failedCount} failed (${successRate}% success rate)`)

    return NextResponse.json({
      status: 'success',
      dry_run: dryRun,
      message: dryRun
        ? `DRY RUN: Would backfill ${successCount} posts`
        : `Backfilled ${successCount} posts`,
      issue_id: issueId,
      total_posts: posts.length,
      succeeded: successCount,
      failed: failedCount,
      success_rate: `${successRate}%`,
      results: results.map(r => ({
        title: r.title.substring(0, 80),
        success: r.success,
        method: r.method,
        full_text_length: r.full_text_length,
        error: r.error
      }))
    })

  } catch (error) {
    console.error('[BACKFILL] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
