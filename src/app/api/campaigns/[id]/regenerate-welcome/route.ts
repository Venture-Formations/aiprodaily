import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    console.log('[API] Regenerating welcome section for campaign:', campaignId)

    // Fetch campaign to verify it exists
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, newsletter_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Fetch ALL active PRIMARY articles for this campaign
    const { data: primaryArticles, error: primaryError } = await supabaseAdmin
      .from('articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (primaryError) {
      console.error('[API] Error fetching primary articles:', primaryError)
      throw primaryError
    }

    // Fetch ALL active SECONDARY articles for this campaign
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (secondaryError) {
      console.error('[API] Error fetching secondary articles:', secondaryError)
      throw secondaryError
    }

    // Combine ALL articles (primary first, then secondary)
    const allArticles = [
      ...(primaryArticles || []),
      ...(secondaryArticles || [])
    ]

    if (allArticles.length === 0) {
      return NextResponse.json(
        {
          error: 'No articles found',
          message: 'Cannot generate welcome section without articles'
        },
        { status: 400 }
      )
    }

    console.log(`[API] Generating welcome from ${primaryArticles?.length || 0} primary and ${secondaryArticles?.length || 0} secondary articles`)

    // Generate welcome text using AI
    const promptOrResult = await AI_PROMPTS.welcomeSection(allArticles)

    console.log('[API] promptOrResult type:', typeof promptOrResult)

    // Parse JSON response to extract intro, tagline, and summary
    let welcomeIntro = ''
    let welcomeTagline = ''
    let welcomeSummary = ''

    try {
      // Check if promptOrResult is already a parsed JSON object with intro/tagline/summary
      if (typeof promptOrResult === 'object' && promptOrResult !== null &&
          ('intro' in promptOrResult || 'tagline' in promptOrResult || 'summary' in promptOrResult)) {
        // Already parsed JSON from structured prompt
        console.log('[API] Using structured prompt result directly')
        welcomeIntro = (promptOrResult as any).intro || ''
        welcomeTagline = (promptOrResult as any).tagline || ''
        welcomeSummary = (promptOrResult as any).summary || ''
      } else if (typeof promptOrResult === 'object' && promptOrResult !== null && 'raw' in promptOrResult) {
        // Got {raw: content} - need to parse the raw JSON string
        console.log('[API] Parsing raw JSON response')
        const rawContent = (promptOrResult as any).raw
        const welcomeJson = JSON.parse(rawContent)
        welcomeIntro = welcomeJson.intro || ''
        welcomeTagline = welcomeJson.tagline || ''
        welcomeSummary = welcomeJson.summary || ''
      } else if (typeof promptOrResult === 'string') {
        // Plain text prompt - need to call OpenAI
        console.log('[API] Calling OpenAI with plain text prompt')
        const welcomeText = await callOpenAI(promptOrResult, 500, 0.8)
        const finalWelcomeText = typeof welcomeText === 'string'
          ? welcomeText.trim()
          : (welcomeText.text || welcomeText.raw || '').trim()

        console.log('[API] Welcome section generated (length:', finalWelcomeText.length, ')')

        // Parse JSON from the text response
        const welcomeJson = JSON.parse(finalWelcomeText)
        welcomeIntro = welcomeJson.intro || ''
        welcomeTagline = welcomeJson.tagline || ''
        welcomeSummary = welcomeJson.summary || ''
      } else {
        throw new Error('Unexpected promptOrResult format')
      }

      console.log('[API] Parsed welcome JSON - intro:', welcomeIntro.length, 'tagline:', welcomeTagline.length, 'summary:', welcomeSummary.length)
    } catch (parseError) {
      console.error('[API] Failed to parse welcome JSON:', parseError)
      console.error('[API] promptOrResult preview:', typeof promptOrResult === 'string'
        ? promptOrResult.substring(0, 200)
        : JSON.stringify(promptOrResult).substring(0, 200))
      // Fallback: use entire text as summary if JSON parsing fails
      welcomeSummary = typeof promptOrResult === 'string' ? promptOrResult : JSON.stringify(promptOrResult)
    }

    // Save all 3 parts to campaign
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        welcome_intro: welcomeIntro,
        welcome_tagline: welcomeTagline,
        welcome_summary: welcomeSummary
      })
      .eq('id', campaignId)

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
            campaign_id: campaignId,
            action: 'welcome_regenerated',
            details: {
              article_count: allArticles.length,
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
      article_count: allArticles.length
    })

  } catch (error) {
    console.error('[API] Failed to regenerate welcome section:', error)
    return NextResponse.json({
      error: 'Failed to regenerate welcome section',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 600
