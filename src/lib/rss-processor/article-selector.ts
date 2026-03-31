import { supabaseAdmin } from '../supabase'
import { AI_CALL } from '../openai'
import { getNewsletterIdFromIssue } from './shared-context'

/**
 * Article selection and subject line generation module.
 * Handles selecting top articles for issues and generating subject lines.
 */
export class ArticleSelector {
  /**
   * @deprecated Article selection now handled by module pipeline (ArticleModuleSelector).
   * This method is a no-op kept for backward compatibility.
   */
  async selectTopArticlesForIssue(issueId: string) {
    console.warn('[DEPRECATED] ArticleSelector.selectTopArticlesForIssue() — module pipeline handles selection via ArticleModuleSelector')
    return
  }

  /**
   * @deprecated No-op. Module pipeline handles primary article selection.
   */
  private async selectTop5Articles(issueId: string) {
    // No-op: Module pipeline handles article selection
    return
  }

  /**
   * @deprecated No-op. Module pipeline handles secondary article selection.
   */
  private async selectTopSecondaryArticles(issueId: string) {
    // No-op: Module pipeline handles article selection
    return
  }

  async generateSubjectLineForIssue(issueId: string) {
    try {
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      const { data: issueWithArticles, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          id,
          date,
          status,
          subject_line,
          module_articles:module_articles(
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
        throw new Error(`issue not found: ${issueError?.message}`)
      }

      if (issueWithArticles.subject_line && issueWithArticles.subject_line.trim()) {
        return
      }

      const activeArticles = (issueWithArticles.module_articles || [])
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        })

      if (activeArticles.length === 0) {
        return
      }

      const topArticle = activeArticles[0] as any

      let result
      try {
        result = await AI_CALL.subjectLineGenerator(topArticle, newsletterId, 100, 0.8)
      } catch (callError) {
        throw new Error(`AI call failed for subject line: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
      }

      let generatedSubject = ''

      if (typeof result === 'string') {
        generatedSubject = result.trim()
      } else if (typeof result === 'object' && result !== null) {
        if ('raw' in result && typeof result.raw === 'string') {
          generatedSubject = result.raw.trim()
        } else if ('subject_line' in result) {
          generatedSubject = String(result.subject_line).trim()
        } else {
          generatedSubject = JSON.stringify(result)
        }
      } else {
        generatedSubject = String(result).trim()
      }

      if (generatedSubject && generatedSubject.trim()) {
        generatedSubject = generatedSubject.trim()

        const { error: updateError } = await supabaseAdmin
          .from('publication_issues')
          .update({
            subject_line: generatedSubject,
            updated_at: new Date().toISOString()
          })
          .eq('id', issueId)

        if (updateError) {
          throw updateError
        }
      } else {
        throw new Error('AI returned empty subject line')
      }

    } catch (error) {
      // Don't throw error - continue with RSS processing even if subject generation fails
    }
  }
}
