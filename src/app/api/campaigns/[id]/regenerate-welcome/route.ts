import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_CALL } from '@/lib/openai'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/regenerate-welcome' },
  async ({ params, session }) => {
    const issueId = params.id

    console.log('[API] Regenerating welcome section for issue:', issueId)

    // Fetch issue to verify it exists
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json(
        { error: 'issue not found' },
        { status: 404 }
      )
    }

    // Fetch ALL active module articles for this issue
    const { data: moduleArticles, error: articlesError } = await supabaseAdmin
      .from('module_articles')
      .select('headline, content')
      .eq('issue_id', issueId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (articlesError) {
      console.error('[API] Error fetching module articles:', articlesError)
      throw articlesError
    }

    if (!moduleArticles || moduleArticles.length === 0) {
      return NextResponse.json(
        {
          error: 'No active articles found',
          message: 'Cannot generate welcome section without active articles'
        },
        { status: 400 }
      )
    }

    console.log(`[API] Generating welcome from ${moduleArticles.length} module articles`)

    // Generate welcome text using AI with the standardized AI_CALL interface
    const result = await AI_CALL.welcomeSection(moduleArticles, issue.publication_id)

    console.log('[API] AI_CALL.welcomeSection result type:', typeof result)

    // Extract intro, tagline, and summary from the result
    let welcomeIntro = ''
    let welcomeTagline = ''
    let welcomeSummary = ''

    try {
      // AI_CALL.welcomeSection returns the parsed JSON response directly
      if (typeof result === 'object' && result !== null) {
        welcomeIntro = result.intro || ''
        welcomeTagline = result.tagline || ''
        welcomeSummary = result.summary || ''
        console.log('[API] Extracted welcome sections - intro:', welcomeIntro.length, 'tagline:', welcomeTagline.length, 'summary:', welcomeSummary.length)
      } else {
        throw new Error('Unexpected result format from AI_CALL.welcomeSection')
      }
    } catch (parseError) {
      console.error('[API] Failed to extract welcome sections:', parseError)
      console.error('[API] Result preview:', JSON.stringify(result).substring(0, 200))
      throw new Error('Failed to generate welcome section')
    }

    // Save all 3 parts to issue
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        welcome_intro: welcomeIntro,
        welcome_tagline: welcomeTagline,
        welcome_summary: welcomeSummary
      })
      .eq('id', issueId)

    if (updateError) {
      console.error('[API] Error saving welcome section:', updateError)
      throw updateError
    }

    // Log user activity
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: issueId,
            action: 'welcome_regenerated',
            details: {
              article_count: moduleArticles.length,
              welcome_intro_length: welcomeIntro.length,
              welcome_tagline_length: welcomeTagline.length,
              welcome_summary_length: welcomeSummary.length
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      welcome_intro: welcomeIntro,
      welcome_tagline: welcomeTagline,
      welcome_summary: welcomeSummary,
      article_count: moduleArticles.length
    })
  }
)

export const maxDuration = 600
