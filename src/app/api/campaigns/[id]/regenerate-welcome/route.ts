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

    // Handle both prompt strings and structured prompt results
    const welcomeText = (typeof promptOrResult === 'object' && promptOrResult !== null && 'raw' in promptOrResult)
      ? (typeof promptOrResult.raw === 'string' ? promptOrResult.raw : promptOrResult.raw?.text || '')
      : await callOpenAI(promptOrResult as string, 300, 0.8)

    const finalWelcomeText = typeof welcomeText === 'string'
      ? welcomeText.trim()
      : (welcomeText.text || welcomeText.raw || '').trim()

    console.log('[API] Welcome section generated (length:', finalWelcomeText.length, ')')

    // Save to campaign
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({ welcome_section: finalWelcomeText })
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
              welcome_length: finalWelcomeText.length
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      welcome_section: finalWelcomeText,
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

export const maxDuration = 60
