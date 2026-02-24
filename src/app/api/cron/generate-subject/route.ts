import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'
import { ScheduleChecker } from '@/lib/schedule-checker'
import type { Logger } from '@/lib/logger'

async function handleGenerateSubject(logger: Logger) {
  console.log('=== AUTOMATED SUBJECT LINE GENERATION CHECK ===')
  console.log('Time:', new Date().toISOString())

  // Check if it's time to run subject generation based on database settings
  const shouldRun = await ScheduleChecker.shouldRunSubjectGeneration()

  if (!shouldRun) {
    return NextResponse.json({
      success: true,
      message: 'Not time to run subject generation or already ran today',
      skipped: true,
      timestamp: new Date().toISOString()
    })
  }

  console.log('=== SUBJECT LINE GENERATION STARTED (Time Matched) ===')
  console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

  // Get tomorrow's issue (created by RSS processing 15 minutes ago)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const issueDate = tomorrow.toISOString().split('T')[0]

  console.log('Generating subject line for tomorrow\'s issue date:', issueDate)

  // Find tomorrow's issue
  const { data: issue, error: issueError } = await supabaseAdmin
    .from('publication_issues')
    .select(`
      id,
      date,
      status,
      subject_line,
      articles:articles(
        headline,
        content,
        is_active,
        rank,
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
      error: 'No issue found for tomorrow',
      issueDate: issueDate
    }, { status: 404 })
  }

  console.log('Found issue:', issue.id, 'Status:', issue.status)

  // Only generate if issue is in draft status
  if (issue.status !== 'draft') {
    return NextResponse.json({
      success: true,
      message: `issue status is ${issue.status}, skipping subject line generation`,
      issueId: issue.id,
      skipped: true
    })
  }

  // Check if subject line already exists
  if (issue.subject_line && issue.subject_line.trim() !== '') {
    console.log('Subject line already exists:', issue.subject_line)
    return NextResponse.json({
      success: true,
      message: 'Subject line already exists',
      issueId: issue.id,
      existingSubjectLine: issue.subject_line,
      skipped: true
    })
  }

  // Get active articles sorted by rank (custom order, rank 1 = #1 position)
  const activeArticles = issue.articles
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

  if (activeArticles.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No active articles found for subject line generation',
      issueId: issue.id
    }, { status: 400 })
  }

  // Use the #1 ranked article for subject line generation
  const topArticle = activeArticles[0] as any
  console.log(`Generating subject line based on #1 ranked article: "${topArticle.headline}" (rank: ${topArticle.rank || 'unranked'}, score: ${topArticle.rss_post?.post_rating?.[0]?.total_score || 0})`)

  // Generate subject line using AI with just the top article
  const prompt = await AI_PROMPTS.subjectLineGenerator(topArticle)
  const result = await callOpenAI(prompt, 1000, 0.8)

  if (!result.subject_line) {
    throw new Error('Invalid subject line response from AI')
  }

  console.log(`Generated subject line: "${result.subject_line}" (${result.character_count} chars)`)

  // Update issue with generated subject line
  const { error: updateError } = await supabaseAdmin
    .from('publication_issues')
    .update({
      subject_line: result.subject_line
    })
    .eq('id', issue.id)

  if (updateError) {
    throw new Error(`Failed to update issue: ${updateError.message}`)
  }

  console.log('=== SUBJECT LINE GENERATION COMPLETED ===')

  return NextResponse.json({
    success: true,
    message: 'Subject line generated successfully',
    issueId: issue.id,
    issueDate: issueDate,
    subjectLine: result.subject_line,
    characterCount: result.character_count,
    topArticleUsed: topArticle.headline,
    timestamp: new Date().toISOString()
  })
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'generate-subject' },
  async ({ logger }) => handleGenerateSubject(logger)
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'generate-subject' },
  async ({ logger }) => handleGenerateSubject(logger)
)
