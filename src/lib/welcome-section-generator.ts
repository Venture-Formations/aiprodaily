import { supabaseAdmin } from '@/lib/supabase'
import { AI_CALL } from '@/lib/openai'

/**
 * Auto-regenerate welcome section for a campaign
 * Called whenever articles are changed (activated, deactivated, reordered)
 */
export async function autoRegenerateWelcome(
  campaignId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[WELCOME] Auto-regenerating welcome section for campaign:', campaignId)

    // Get newsletter_id from campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('newsletter_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign || !campaign.newsletter_id) {
      console.error('[WELCOME] Failed to get newsletter_id for campaign:', campaignError)
      return { success: false, error: 'Failed to get campaign newsletter_id' }
    }

    const newsletterId = campaign.newsletter_id

    // Fetch ALL active PRIMARY articles for this campaign
    const { data: primaryArticles, error: primaryError } = await supabaseAdmin
      .from('articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (primaryError) {
      console.error('[WELCOME] Error fetching primary articles:', primaryError)
      return { success: false, error: primaryError.message }
    }

    // Fetch ALL active SECONDARY articles for this campaign
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (secondaryError) {
      console.error('[WELCOME] Error fetching secondary articles:', secondaryError)
      return { success: false, error: secondaryError.message }
    }

    // Combine ALL articles (primary first, then secondary)
    const allArticles = [
      ...(primaryArticles || []),
      ...(secondaryArticles || [])
    ]

    if (allArticles.length === 0) {
      console.log('[WELCOME] No articles found, skipping welcome regeneration')
      return { success: false, error: 'No articles found' }
    }

    console.log(`[WELCOME] Generating welcome from ${primaryArticles?.length || 0} primary and ${secondaryArticles?.length || 0} secondary articles`)

    // Generate welcome text using AI_CALL (handles prompt + provider + call)
    const result = await AI_CALL.welcomeSection(allArticles, newsletterId, 500, 0.8)

    // Parse JSON response to extract intro, tagline, and summary
    let welcomeIntro = ''
    let welcomeTagline = ''
    let welcomeSummary = ''

    try {
      // Handle response (could be object or string)
      if (typeof result === 'object' && result !== null) {
        // Check if it's already parsed JSON
        if ('intro' in result || 'tagline' in result || 'summary' in result) {
          welcomeIntro = (result as any).intro || ''
          welcomeTagline = (result as any).tagline || ''
          welcomeSummary = (result as any).summary || ''
        } else {
          // Try parsing as JSON string
          const welcomeJson = JSON.parse(JSON.stringify(result))
          welcomeIntro = welcomeJson.intro || ''
          welcomeTagline = welcomeJson.tagline || ''
          welcomeSummary = welcomeJson.summary || ''
        }
      } else if (typeof result === 'string') {
        // Parse JSON from string
        const welcomeJson = JSON.parse(result)
        welcomeIntro = welcomeJson.intro || ''
        welcomeTagline = welcomeJson.tagline || ''
        welcomeSummary = welcomeJson.summary || ''
      }

      console.log('[WELCOME] Parsed welcome JSON - intro:', welcomeIntro.length, 'tagline:', welcomeTagline.length, 'summary:', welcomeSummary.length)
    } catch (parseError) {
      console.error('[WELCOME] Failed to parse welcome JSON:', parseError)
      return { success: false, error: 'Failed to parse welcome JSON' }
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
      console.error('[WELCOME] Error saving welcome section:', updateError)
      return { success: false, error: updateError.message }
    }

    // Log user activity
    if (userEmail) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            campaign_id: campaignId,
            action: 'welcome_auto_regenerated',
            details: {
              article_count: allArticles.length,
              welcome_intro_length: welcomeIntro.length,
              welcome_tagline_length: welcomeTagline.length,
              welcome_summary_length: welcomeSummary.length
            }
          }])
      }
    }

    console.log('[WELCOME] Welcome section auto-regenerated successfully')
    return { success: true }

  } catch (error) {
    console.error('[WELCOME] Failed to auto-regenerate welcome section:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
