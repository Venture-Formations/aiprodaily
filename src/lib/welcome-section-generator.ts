import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

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

    // Generate welcome text using AI
    const promptOrResult = await AI_PROMPTS.welcomeSection(allArticles)

    // Parse JSON response to extract intro, tagline, and summary
    let welcomeIntro = ''
    let welcomeTagline = ''
    let welcomeSummary = ''

    try {
      // Check if promptOrResult is already a parsed JSON object with intro/tagline/summary
      if (typeof promptOrResult === 'object' && promptOrResult !== null &&
          ('intro' in promptOrResult || 'tagline' in promptOrResult || 'summary' in promptOrResult)) {
        // Already parsed JSON from structured prompt
        console.log('[WELCOME] Using structured prompt result directly')
        welcomeIntro = (promptOrResult as any).intro || ''
        welcomeTagline = (promptOrResult as any).tagline || ''
        welcomeSummary = (promptOrResult as any).summary || ''
      } else if (typeof promptOrResult === 'object' && promptOrResult !== null && 'raw' in promptOrResult) {
        // Got {raw: content} - need to parse the raw JSON string
        console.log('[WELCOME] Parsing raw JSON response')
        const rawContent = (promptOrResult as any).raw
        const welcomeJson = JSON.parse(rawContent)
        welcomeIntro = welcomeJson.intro || ''
        welcomeTagline = welcomeJson.tagline || ''
        welcomeSummary = welcomeJson.summary || ''
      } else if (typeof promptOrResult === 'string') {
        // Plain text prompt - need to call OpenAI
        console.log('[WELCOME] Calling OpenAI with plain text prompt')
        const welcomeText = await callOpenAI(promptOrResult, 500, 0.8)
        const finalWelcomeText = typeof welcomeText === 'string'
          ? welcomeText.trim()
          : (welcomeText.text || welcomeText.raw || '').trim()

        // Parse JSON from the text response
        const welcomeJson = JSON.parse(finalWelcomeText)
        welcomeIntro = welcomeJson.intro || ''
        welcomeTagline = welcomeJson.tagline || ''
        welcomeSummary = welcomeJson.summary || ''
      } else {
        throw new Error('Unexpected promptOrResult format')
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
