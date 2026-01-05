import { supabaseAdmin } from '@/lib/supabase'
import { AI_CALL } from '@/lib/openai'

export interface SubjectLineResult {
  success: boolean
  subject_line?: string
  character_count?: number
  top_article_used?: string
  top_article_score?: number
  error?: string
}

/**
 * Generates a subject line for a issue using the current #1 ranked active non-skipped article
 */
export async function generateSubjectLine(issueId: string, userEmail?: string): Promise<SubjectLineResult> {
  try {
    console.log(`Auto-generating subject line for issue: ${issueId}`)

    // Fetch issue with active module articles
    let { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        publication_id,
        module_articles:module_articles(
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
      .eq('id', issueId)
      .single()

    if (error) {
      console.error('issue fetch error:', error)
      return { success: false, error: 'issue not found' }
    }

    if (!issue) {
      return { success: false, error: 'issue not found' }
    }

    // Get and validate publication_id
    const newsletterId = issue.publication_id
    if (!newsletterId) {
      return { success: false, error: 'issue missing publication_id' }
    }

    // Get active articles sorted by rank (excluding skipped)
    const activeArticles = (issue.module_articles || [])
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

    // Generate subject line using AI_CALL (handles prompt + provider + call)
    const result = await AI_CALL.subjectLineGenerator(topArticle, newsletterId, 100, 0.8)

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

    // Update issue with generated subject line
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        subject_line: subjectLine
      })
      .eq('id', issueId)

    if (updateError) {
      console.error('Failed to update issue with subject line:', updateError)
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
              issue_id: issueId,
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
 * Gets the current #1 ranked active non-skipped article for an issue
 */
export async function getCurrentTopArticle(issueId: string): Promise<{ article: any | null, error?: string }> {
  try {
    // Fetch issue module articles
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        module_articles:module_articles(
          id,
          headline,
          is_active,
          skipped,
          rank
        )
      `)
      .eq('id', issueId)
      .single()

    if (error) {
      return { article: null, error: 'issue not found' }
    }

    if (!issue) {
      return { article: null, error: 'issue not found' }
    }

    // Get the current #1 article (active, non-skipped, lowest rank)
    const activeArticles = (issue.module_articles || [])
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