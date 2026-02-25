import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/complete-campaign' },
  async ({ request, logger }) => {
    console.log('=== COMPLETING INTERRUPTED issue ===')

    // Get the issue ID from request body or find latest
    const body = await request.json().catch(() => ({}))
    let issueId = body.issueId

    if (!issueId) {
      // Find the most recent issue
      const { data: latestissue, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !latestissue) {
        return NextResponse.json({
          success: false,
          error: 'No issue found to complete'
        }, { status: 404 })
      }

      issueId = latestissue.id
      console.log('Found latest issue:', issueId, 'Status:', latestissue.status)
    }

    // Get issue with articles
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          headline,
          content,
          is_active,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'issue not found',
        issueId
      }, { status: 404 })
    }

    const fixes = []

    // Fix 1: Reset status to draft
    if (issue.status !== 'draft') {
      await supabaseAdmin
        .from('publication_issues')
        .update({
          status: 'draft',
          review_sent_at: null
        })
        .eq('id', issueId)

      fixes.push(`Status changed from '${issue.status}' to 'draft'`)
    }

    // Fix 2: Generate subject line if missing
    let generatedSubject = issue.subject_line
    if (!issue.subject_line) {
      console.log('Generating missing subject line...')

      const activeArticles = issue.articles
        ?.filter((article: any) => article.is_active)
        ?.sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        }) || []

      if (activeArticles.length > 0) {
        const topArticle = activeArticles[0]
        const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${new Date().toISOString()}`

        try {
          const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)
          if (aiResponse && aiResponse.trim()) {
            generatedSubject = aiResponse.trim()

            await supabaseAdmin
              .from('publication_issues')
              .update({
                subject_line: generatedSubject,
                updated_at: new Date().toISOString()
              })
              .eq('id', issueId)

            fixes.push(`Generated subject line: "${generatedSubject}"`)
          }
        } catch (error) {
          fixes.push('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'issue completion fixes applied',
      issueId,
      originalStatus: issue.status,
      subjectLine: generatedSubject,
      activeArticles: issue.articles?.filter((a: any) => a.is_active).length || 0,
      totalArticles: issue.articles?.length || 0,
      fixesApplied: fixes,
      timestamp: new Date().toISOString()
    })
  }
)
