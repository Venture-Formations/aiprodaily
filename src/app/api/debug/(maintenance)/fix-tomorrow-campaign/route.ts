import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/fix-tomorrow-campaign' },
  async ({ request, logger }) => {

  try {
    console.log('=== FIXING TOMORROW\'S issue ===')

    // Get tomorrow's issue
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Fixing issue for date:', issueDate)

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
      .eq('date', issueDate)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'issue not found for tomorrow',
        issueDate
      }, { status: 404 })
    }

    console.log('Found issue:', issue.id, 'Status:', issue.status)

    const fixes = []

    // Fix 1: Reset status to draft
    if (issue.status !== 'draft') {
      await supabaseAdmin
        .from('publication_issues')
        .update({
          status: 'draft',
          review_sent_at: null // Clear previous review timestamp
        })
        .eq('id', issue.id)

      fixes.push(`Status changed from '${issue.status}' to 'draft'`)
      console.log('Reset issue status to draft')
    }

    // Fix 2: Generate subject line if missing
    let generatedSubject = issue.subject_line
    if (!issue.subject_line || (typeof issue.subject_line === 'string' && issue.subject_line.trim() === '')) {
      console.log('Generating missing subject line...')

      // Get active articles sorted by AI score
      const activeArticles = issue.articles
        ?.filter((article: any) => article.is_active)
        ?.sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        }) || []

      if (activeArticles.length > 0) {
        // Use the highest scored article for subject line generation
        const topArticle = activeArticles[0] as any
        console.log('Using top article:', topArticle.headline)

        // Generate subject line using AI
        const timestamp = new Date().toISOString()
        const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${timestamp}`

        const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

        if (aiResponse && aiResponse.trim()) {
          generatedSubject = aiResponse.trim()
          console.log('Generated subject line:', generatedSubject)

          // Update issue with generated subject line
          await supabaseAdmin
            .from('publication_issues')
            .update({
              subject_line: generatedSubject,
              updated_at: new Date().toISOString()
            })
            .eq('id', issue.id)

          fixes.push(`Generated subject line: "${generatedSubject}"`)
        } else {
          fixes.push('Failed to generate subject line - AI returned empty response')
        }
      } else {
        fixes.push('Cannot generate subject line - no active articles found')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'issue fixes applied',
      issueId: issue.id,
      issueDate,
      originalStatus: issue.status,
      originalSubjectLine: issue.subject_line,
      newSubjectLine: generatedSubject,
      fixesApplied: fixes,
      nextStep: 'issue should now be ready for MailerLite creation',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Fix issue error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
  }
)