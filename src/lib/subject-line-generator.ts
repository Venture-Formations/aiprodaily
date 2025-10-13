import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export interface SubjectLineResult {
  success: boolean
  subject_line?: string
  character_count?: number
  top_article_used?: string
  top_article_score?: number
  error?: string
}

/**
 * Generates a subject line for a campaign using the current #1 ranked active non-skipped article
 */
export async function generateSubjectLine(campaignId: string, userEmail?: string): Promise<SubjectLineResult> {
  try {
    console.log(`Auto-generating subject line for campaign: ${campaignId}`)

    // Fetch campaign with active articles
    let { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          headline,
          content,
          is_active,
          skipped,
          rank,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', campaignId)
      .single()

    if (error) {
      console.error('Campaign fetch error:', error)

      // If the error is about the skipped column not existing, try without it
      if (error.message?.includes('column "skipped" of relation "articles" does not exist')) {
        console.log('Skipped column does not exist, trying without it...')
        const { data: campaignFallback, error: fallbackError } = await supabaseAdmin
          .from('newsletter_campaigns')
          .select(`
            *,
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
          .eq('id', campaignId)
          .single()

        if (fallbackError || !campaignFallback) {
          return { success: false, error: 'Campaign not found' }
        }

        campaign = campaignFallback
      } else {
        return { success: false, error: 'Campaign not found' }
      }
    }

    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    // Get active articles sorted by rank (excluding skipped)
    const activeArticles = campaign.articles
      .filter((article: any) => {
        // Always check is_active
        if (!article.is_active) return false

        // Check skipped only if the field exists
        if (article.hasOwnProperty('skipped') && article.skipped) return false

        return true
      })
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

    if (activeArticles.length === 0) {
      return { success: false, error: 'No active articles found for subject line generation' }
    }

    const topArticle = activeArticles[0]
    console.log(`Auto-generating subject line based on current #1 article: "${topArticle.headline}" (rank: ${topArticle.rank || 'unranked'})`)

    // Generate subject line using AI
    const variationPrompt = await AI_PROMPTS.subjectLineGenerator([topArticle]) +
      `\n\nGeneration timestamp: ${new Date().toISOString()} - Create a fresh, unique headline variation.`

    const result = await callOpenAI(variationPrompt, 1000, 0.8)

    // Handle both plain text and JSON responses
    let subjectLine = ''
    if (typeof result === 'string') {
      subjectLine = result.trim()
    } else if (result && typeof result === 'object') {
      if (result.subject_line) {
        subjectLine = result.subject_line.trim()
      } else if (result.raw) {
        subjectLine = result.raw.trim()
      } else {
        subjectLine = String(result).trim()
      }
    } else {
      subjectLine = String(result).trim()
    }

    if (!subjectLine) {
      return { success: false, error: 'Empty subject line response from AI' }
    }

    // Enforce character limit
    if (subjectLine.length > 35) {
      console.warn(`Subject line too long (${subjectLine.length} chars), truncating to 35`)
      subjectLine = subjectLine.substring(0, 35).trim()
    }

    // Update campaign with generated subject line
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        subject_line: subjectLine
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Failed to update campaign with subject line:', updateError)
      return { success: false, error: 'Failed to save subject line' }
    }

    // Log user activity if user email provided
    if (userEmail) {
      try {
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
              action: 'subject_line_auto_generated',
              details: {
                subject_line: subjectLine,
                character_count: subjectLine.length,
                top_article_headline: topArticle.headline,
                top_article_score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0,
                trigger: 'article_change'
              }
            }])
        }
      } catch (logError) {
        console.error('Failed to log auto subject line generation:', logError)
        // Don't fail the entire operation for logging errors
      }
    }

    console.log(`Auto-generated subject line: "${subjectLine}" (${subjectLine.length} chars)`)

    return {
      success: true,
      subject_line: subjectLine,
      character_count: subjectLine.length,
      top_article_used: topArticle.headline,
      top_article_score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0
    }

  } catch (error) {
    console.error('Failed to auto-generate subject line:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Gets the current #1 ranked active non-skipped article for a campaign
 */
export async function getCurrentTopArticle(campaignId: string): Promise<{ article: any | null, error?: string }> {
  try {
    // Fetch campaign articles
    let { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        articles:articles(
          id,
          headline,
          is_active,
          skipped,
          rank
        )
      `)
      .eq('id', campaignId)
      .single()

    if (error) {
      // Try without skipped column if it doesn't exist
      if (error.message?.includes('column "skipped" of relation "articles" does not exist')) {
        const { data: campaignFallback, error: fallbackError } = await supabaseAdmin
          .from('newsletter_campaigns')
          .select(`
            articles:articles(
              id,
              headline,
              is_active,
              rank
            )
          `)
          .eq('id', campaignId)
          .single()

        if (fallbackError || !campaignFallback) {
          return { article: null, error: 'Campaign not found' }
        }

        // Add skipped: false to each article since the column doesn't exist
        campaignFallback.articles = campaignFallback.articles.map((article: any) => ({
          ...article,
          skipped: false
        }))

        campaign = campaignFallback as any
      } else {
        return { article: null, error: 'Campaign not found' }
      }
    }

    if (!campaign) {
      return { article: null, error: 'Campaign not found' }
    }

    // Get the current #1 article (active, non-skipped, lowest rank)
    const activeArticles = campaign.articles
      .filter((article: any) => {
        if (!article.is_active) return false
        if (article.hasOwnProperty('skipped') && article.skipped) return false
        return true
      })
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

    return {
      article: activeArticles.length > 0 ? activeArticles[0] : null
    }

  } catch (error) {
    console.error('Failed to get current top article:', error)
    return { article: null, error: 'Failed to fetch current top article' }
  }
}