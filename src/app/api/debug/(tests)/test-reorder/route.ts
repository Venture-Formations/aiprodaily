import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentTopArticle } from '@/lib/subject-line-generator'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-reorder' },
  async ({ request, logger }) => {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
    }

    console.log(`Testing reorder logic for issue: ${issueId}`)

    // Get current issue and articles
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        subject_line,
        articles:articles(
          id,
          headline,
          is_active,
          skipped,
          rank,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        error: 'issue not found',
        details: issueError?.message
      }, { status: 404 })
    }

    console.log('Raw issue data:', JSON.stringify(issue, null, 2))

    // Test getCurrentTopArticle function
    const { article: currentTopArticle, error: topArticleError } = await getCurrentTopArticle(issueId)

    if (topArticleError) {
      console.error('Error getting current top article:', topArticleError)
    }

    console.log('Current top article from function:', currentTopArticle)

    // Manual filtering logic to debug
    const activeArticles = issue.articles
      .filter((article: any) => {
        console.log(`Checking article: ${article.headline}`)
        console.log(`  is_active: ${article.is_active}`)
        console.log(`  skipped: ${article.skipped}`)
        console.log(`  rank: ${article.rank}`)

        if (!article.is_active) {
          console.log(`  -> EXCLUDED: not active`)
          return false
        }

        if (article.hasOwnProperty('skipped') && article.skipped) {
          console.log(`  -> EXCLUDED: skipped`)
          return false
        }

        console.log(`  -> INCLUDED`)
        return true
      })
      .sort((a: any, b: any) => {
        const rankA = a.rank || 999
        const rankB = b.rank || 999
        console.log(`Sorting: ${a.headline} (rank ${rankA}) vs ${b.headline} (rank ${rankB})`)
        return rankA - rankB
      })

    console.log('Filtered and sorted active articles:', activeArticles.map((a: any) => ({
      id: a.id,
      headline: a.headline,
      rank: a.rank,
      is_active: a.is_active,
      skipped: a.skipped
    })))

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      current_subject_line: issue.subject_line,
      total_articles: issue.articles.length,
      active_articles_count: activeArticles.length,
      current_top_article: currentTopArticle,
      top_article_error: topArticleError,
      active_articles: activeArticles.map((a: any) => ({
        id: a.id,
        headline: a.headline,
        rank: a.rank,
        is_active: a.is_active,
        skipped: a.skipped
      })),
      all_articles: issue.articles.map((a: any) => ({
        id: a.id,
        headline: a.headline,
        rank: a.rank,
        is_active: a.is_active,
        skipped: a.skipped
      }))
    })

  } catch (error) {
    console.error('Debug test failed:', error)
    return NextResponse.json({
      error: 'Debug test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)