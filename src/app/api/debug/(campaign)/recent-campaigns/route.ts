import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get recent issues
    const { data: issues, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, subject_line, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For the most recent issue, get detailed info
    if (issues && issues.length > 0) {
      const latestIssue = issues[0]

      const { data: detailedIssue, error: detailError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            id,
            headline,
            content,
            is_active,
            rss_post:rss_posts(
              title,
              description,
              post_rating:post_ratings(total_score)
            )
          )
        `)
        .eq('id', latestIssue.id)
        .single()

      if (!detailError && detailedIssue) {
        // Get active articles sorted by rating
        const activeArticles = detailedIssue.articles
          .filter((article: any) => article.is_active)
          .sort((a: any, b: any) => {
            const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
            const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
            return scoreB - scoreA
          })

        return NextResponse.json({
          recent_issues: issues,
          latest_issue_details: {
            id: detailedIssue.id,
            date: detailedIssue.date,
            status: detailedIssue.status,
            subject_line: detailedIssue.subject_line,
            total_articles: detailedIssue.articles.length,
            active_articles_count: activeArticles.length,
            top_article: activeArticles[0] ? {
              id: activeArticles[0].id,
              headline: activeArticles[0].headline,
              content_preview: activeArticles[0].content?.substring(0, 300) + '...',
              content_full_length: activeArticles[0].content?.length || 0,
              score: activeArticles[0].rss_post?.post_rating?.[0]?.total_score || 0,
              rss_title: activeArticles[0].rss_post?.title,
              rss_description: activeArticles[0].rss_post?.description?.substring(0, 200) + '...'
            } : null,
            all_active_articles: activeArticles.slice(0, 5).map((article: any, index: number) => ({
              rank: index + 1,
              id: article.id,
              headline: article.headline,
              score: article.rss_post?.post_rating?.[0]?.total_score || 0,
              content_preview: article.content?.substring(0, 100) + '...'
            }))
          }
        })
      }
    }

    return NextResponse.json({ recent_issues: issues })

  } catch (error) {
    console.error('Debug recent issues error:', error)
    return NextResponse.json({
      error: 'Failed to fetch issues',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}