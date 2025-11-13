import { supabaseAdmin } from '@/lib/supabase'
import { AI_CALL } from '@/lib/openai'

/**
 * Auto-regenerate welcome section for an issue
 * Called whenever articles are changed (activated, deactivated, reordered)
 */
export async function autoRegenerateWelcome(
  issueId: string,
  userEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[WELCOME] Auto-regenerating welcome section for issue:', issueId)

    // Get publication_id from issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue || !issue.publication_id) {
      console.error('[WELCOME] Failed to get publication_id for issue:', issueError)
      return { success: false, error: 'Failed to get issue publication_id' }
    }

    const newsletterId = issue.publication_id

    // Fetch ALL active PRIMARY articles for this issue
    const { data: primaryArticles, error: primaryError } = await supabaseAdmin
      .from('articles')
      .select('headline, content')
      .eq('issue_id', issueId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (primaryError) {
      console.error('[WELCOME] Error fetching primary articles:', primaryError)
      return { success: false, error: primaryError.message }
    }

    // Fetch ALL active SECONDARY articles for this issue
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select('headline, content')
      .eq('issue_id', issueId)
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
    const result = await AI_CALL.welcomeSection(allArticles, newsletterId)

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
        console.log('[WELCOME] Extracted welcome sections - intro:', welcomeIntro.length, 'tagline:', welcomeTagline.length, 'summary:', welcomeSummary.length)
      } else {
        throw new Error('Unexpected result format from AI_CALL.welcomeSection')
      }
    } catch (parseError) {
      console.error('[WELCOME] Failed to extract welcome sections:', parseError)
      console.error('[WELCOME] Result preview:', JSON.stringify(result).substring(0, 200))
      return { success: false, error: 'Failed to generate welcome section' }
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
            issue_id: issueId,
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
