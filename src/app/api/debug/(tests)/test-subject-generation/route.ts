import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-subject-generation' },
  async ({ request, logger }) => {
  try {
    console.log('=== TESTING SUBJECT LINE GENERATION ===')

    // Get issue ID from request or use latest
    const body = await request.json().catch(() => ({}))
    let issueId = body.issueId

    if (!issueId) {
      const { data: issue, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !issue) {
        return NextResponse.json({
          success: false,
          error: 'No issue found'
        }, { status: 404 })
      }

      issueId = issue.id
    }

    console.log('Testing subject line generation for issue:', issueId)

    // Get the issue with its articles for subject line generation
    const { data: issueWithArticles, error: issueError } = await supabaseAdmin
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
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', issueId)
      .single()

    if (issueError || !issueWithArticles) {
      console.error('Failed to fetch issue for subject generation:', issueError)
      return NextResponse.json({
        success: false,
        error: `issue not found: ${issueError?.message}`
      }, { status: 404 })
    }

    console.log('issue found:', {
      id: issueWithArticles.id,
      currentSubject: issueWithArticles.subject_line,
      totalArticles: issueWithArticles.articles?.length || 0
    })

    // Get active articles sorted by AI score
    const activeArticles = issueWithArticles.articles
      ?.filter((article: any) => article.is_active)
      ?.sort((a: any, b: any) => {
        const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
        const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
        return scoreB - scoreA
      }) || []

    console.log('Active articles found:', activeArticles.length)

    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for subject line generation',
        issueData: {
          totalArticles: issueWithArticles.articles?.length || 0,
          activeArticles: 0
        }
      })
    }

    // Use the highest scored article for subject line generation
    const topArticle = activeArticles[0] as any
    console.log('Top article:', {
      headline: topArticle.headline,
      score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0,
      hasRssPost: !!topArticle.rss_post,
      hasRating: !!topArticle.rss_post?.post_rating?.[0]
    })

    // Generate subject line using AI
    const timestamp = new Date().toISOString()
    const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${timestamp}`

    console.log('Generating AI subject line...')
    console.log('Prompt preview:', subjectPrompt.substring(0, 200) + '...')

    const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

    console.log('AI Response type:', typeof aiResponse)
    console.log('AI Response:', aiResponse)

    // The AI now returns plain text, not JSON
    let generatedSubject = ''

    if (typeof aiResponse === 'string') {
      generatedSubject = aiResponse
      console.log('Using string response directly')
    } else if (typeof aiResponse === 'object' && aiResponse && 'raw' in aiResponse) {
      generatedSubject = (aiResponse as any).raw
      console.log('Using raw property from object response')
    } else if (typeof aiResponse === 'object') {
      // Fallback: convert to string
      generatedSubject = JSON.stringify(aiResponse)
      console.log('Converting object to string as fallback')
    } else {
      console.log('Unknown response type:', typeof aiResponse, aiResponse)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response type',
        responseType: typeof aiResponse,
        response: aiResponse
      }, { status: 500 })
    }

    console.log('Final generated subject:', generatedSubject)

    if (generatedSubject && generatedSubject.trim()) {
      generatedSubject = generatedSubject.trim()
      console.log('Generated subject line:', generatedSubject)

      // Update issue with generated subject line
      const { error: updateError } = await supabaseAdmin
        .from('publication_issues')
        .update({
          subject_line: generatedSubject,
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId)

      if (updateError) {
        console.error('Failed to update issue with subject line:', updateError)
        return NextResponse.json({
          success: false,
          error: 'Failed to update issue with subject line',
          details: updateError.message,
          generatedSubject
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Subject line generated and updated successfully',
        issueId,
        generatedSubject,
        topArticle: {
          headline: topArticle.headline,
          score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0
        },
        activeArticlesCount: activeArticles.length,
        timestamp: new Date().toISOString()
      })

    } else {
      console.error('AI failed to generate subject line - empty response')
      return NextResponse.json({
        success: false,
        error: 'AI returned empty subject line',
        promptUsed: subjectPrompt.substring(0, 500) + '...',
        topArticle: {
          headline: topArticle.headline,
          score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Subject line generation test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
  }
)