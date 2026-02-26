import { supabaseAdmin } from '../supabase'
import { AI_CALL } from '../openai'
import { getNewsletterIdFromIssue } from './shared-context'

/**
 * Article selection and subject line generation module.
 * Handles selecting top articles for issues and generating subject lines.
 */
export class ArticleSelector {
  /**
   * Public method to select top articles - used by step-based processing
   */
  async selectTopArticlesForIssue(issueId: string) {
    await this.selectTop5Articles(issueId)
    await this.selectTopSecondaryArticles(issueId)
  }

  private async selectTop5Articles(issueId: string) {
    try {
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      // Get max_top_articles setting (defaults to 3)
      const { data: maxTopArticlesSetting } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', newsletterId)
        .eq('key', 'max_top_articles')
        .single()

      let finalArticleCount = maxTopArticlesSetting ? parseInt(maxTopArticlesSetting.value) : 3
      let manualArticlesUsed = 0

      // Check for available manual articles for the primary section
      const { data: manualArticles, error: manualError } = await supabaseAdmin
        .from('manual_articles')
        .select('*')
        .eq('publication_id', newsletterId)
        .eq('section_type', 'primary_articles')
        .eq('status', 'published')
        .is('used_in_issue_id', null)
        .order('publish_date', { ascending: true })
        .limit(finalArticleCount)

      if (manualError) {
        console.log(`[Primary Selection] Manual articles query error:`, manualError.message)
      }

      // Use manual articles if available
      if (manualArticles && manualArticles.length > 0) {
        console.log(`[Primary Selection] Found ${manualArticles.length} manual article(s) to use`)

        for (const manual of manualArticles) {
          manualArticlesUsed++
          const rank = manualArticlesUsed

          const { error: insertError } = await supabaseAdmin
            .from('articles')
            .insert({
              post_id: null,
              issue_id: issueId,
              headline: manual.title,
              content: manual.body,
              rank: rank,
              is_active: true,
              skipped: false,
              fact_check_score: 100,
              word_count: manual.body.replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length
            })

          if (insertError) {
            console.error(`[Primary Selection] Failed to insert manual article ${manual.id}:`, insertError.message)
            manualArticlesUsed--
            continue
          }

          await supabaseAdmin
            .from('manual_articles')
            .update({
              status: 'used',
              used_in_issue_id: issueId,
              used_at: new Date().toISOString()
            })
            .eq('id', manual.id)

          console.log(`[Primary Selection] ✓ Used manual article: "${manual.title}" (rank ${rank})`)
        }

        finalArticleCount = finalArticleCount - manualArticlesUsed
        console.log(`[Primary Selection] Need ${finalArticleCount} more RSS article(s) to fill remaining slots`)

        if (finalArticleCount <= 0) {
          console.log(`[Primary Selection] All slots filled by manual articles`)
          await this.generateSubjectLineForIssue(issueId)
          return
        }
      }

      // Get lookback hours setting (defaults to 72 hours)
      const { data: lookbackSetting } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', newsletterId)
        .eq('key', 'primary_article_lookback_hours')
        .single()

      const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
      const lookbackDate = new Date()
      lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
      const lookbackTimestamp = lookbackDate.toISOString()

      const { data: availableArticles, error } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          issue_id,
          fact_check_score,
          created_at,
          final_position,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        `)
        .gte('created_at', lookbackTimestamp)
        .gte('fact_check_score', 12)
        .is('final_position', null)

      console.log(`[Primary Selection] Target: ${finalArticleCount} articles`)
      console.log(`[Primary Selection] Lookback: ${lookbackHours} hours (since ${lookbackTimestamp})`)

      if (error) {
        console.error(`[Primary Selection] Query error:`, error.message)
        return
      }

      if (!availableArticles || availableArticles.length === 0) {
        console.log(`[Primary Selection] No articles found matching criteria`)
        return
      }

      console.log(`[Primary Selection] Found ${availableArticles.length} articles meeting criteria (fact_check_score >= 12, not used in sent newsletters)`)

      const sortedArticles = availableArticles
        .map((article: any) => ({
          id: article.id,
          current_issue_id: article.issue_id,
          score: article.rss_post?.post_rating?.[0]?.total_score || 0,
          created_at: article.created_at
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, finalArticleCount)

      console.log(`[Primary Selection] Selected ${sortedArticles.length} articles (sorted by score):`)
      sortedArticles.forEach((a, idx) => {
        console.log(`  ${idx + 1}. Article ${a.id} - Score: ${a.score}`)
      })

      if (sortedArticles.length === 0) {
        console.log(`[Primary Selection] No articles to activate after sorting`)
        return
      }

      for (let i = 0; i < sortedArticles.length; i++) {
        const article = sortedArticles[i]

        await supabaseAdmin
          .from('articles')
          .update({
            issue_id: issueId,
            is_active: true,
            rank: i + 1 + manualArticlesUsed
          })
          .eq('id', article.id)
      }

      console.log(`[Primary Selection] ✓ Activated ${sortedArticles.length} RSS articles for issue (ranks ${manualArticlesUsed + 1}-${manualArticlesUsed + sortedArticles.length})`)

      await this.generateSubjectLineForIssue(issueId)

    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error selecting top articles:', errorMsg)
    }
  }

  private async selectTopSecondaryArticles(issueId: string) {
    try {
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      const { data: maxSecondaryArticlesSetting } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', newsletterId)
        .eq('key', 'max_secondary_articles')
        .single()

      let finalArticleCount = maxSecondaryArticlesSetting ? parseInt(maxSecondaryArticlesSetting.value) : 3
      let manualArticlesUsed = 0

      const { data: manualArticles, error: manualError } = await supabaseAdmin
        .from('manual_articles')
        .select('*')
        .eq('publication_id', newsletterId)
        .eq('section_type', 'secondary_articles')
        .eq('status', 'published')
        .is('used_in_issue_id', null)
        .order('publish_date', { ascending: true })
        .limit(finalArticleCount)

      if (manualError) {
        console.log(`[Secondary Selection] Manual articles query error:`, manualError.message)
      }

      if (manualArticles && manualArticles.length > 0) {
        console.log(`[Secondary Selection] Found ${manualArticles.length} manual article(s) to use`)

        for (const manual of manualArticles) {
          manualArticlesUsed++
          const rank = manualArticlesUsed

          const { error: insertError } = await supabaseAdmin
            .from('secondary_articles')
            .insert({
              post_id: null,
              issue_id: issueId,
              headline: manual.title,
              content: manual.body,
              rank: rank,
              is_active: true,
              skipped: false,
              fact_check_score: 100,
              word_count: manual.body.replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length
            })

          if (insertError) {
            console.error(`[Secondary Selection] Failed to insert manual article ${manual.id}:`, insertError.message)
            manualArticlesUsed--
            continue
          }

          await supabaseAdmin
            .from('manual_articles')
            .update({
              status: 'used',
              used_in_issue_id: issueId,
              used_at: new Date().toISOString()
            })
            .eq('id', manual.id)

          console.log(`[Secondary Selection] ✓ Used manual article: "${manual.title}" (rank ${rank})`)
        }

        finalArticleCount = finalArticleCount - manualArticlesUsed
        console.log(`[Secondary Selection] Need ${finalArticleCount} more RSS article(s) to fill remaining slots`)

        if (finalArticleCount <= 0) {
          console.log(`[Secondary Selection] All slots filled by manual articles`)
          return
        }
      }

      const { data: lookbackSetting } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', newsletterId)
        .eq('key', 'secondary_article_lookback_hours')
        .single()

      const baseLookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 36

      console.log(`[Secondary Selection] Target: ${finalArticleCount} RSS articles (after ${manualArticlesUsed} manual)`)

      // Progressive fallback: try with decreasing score thresholds
      const fallbackStrategies = [
        { scoreThreshold: 15, lookbackMultiplier: 1, description: 'strict criteria (score >= 15)' },
        { scoreThreshold: 10, lookbackMultiplier: 1, description: 'reduced score threshold (score >= 10)' },
        { scoreThreshold: 5, lookbackMultiplier: 1, description: 'low score threshold (score >= 5)' },
        { scoreThreshold: 0, lookbackMultiplier: 1, description: 'no score filter' }
      ]

      const selectedArticles: { id: string; current_issue_id: string; score: number; created_at: string }[] = []
      const selectedIds = new Set<string>()

      for (const strategy of fallbackStrategies) {
        if (selectedArticles.length >= finalArticleCount) {
          break
        }

        const lookbackHours = baseLookbackHours * strategy.lookbackMultiplier
        const lookbackDate = new Date()
        lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
        const lookbackTimestamp = lookbackDate.toISOString()

        console.log(`[Secondary Selection] Trying ${strategy.description}: lookback ${lookbackHours}h, score >= ${strategy.scoreThreshold}`)

        let query = supabaseAdmin
          .from('secondary_articles')
          .select(`
            id,
            issue_id,
            fact_check_score,
            created_at,
            final_position,
            rss_post:rss_posts(
              post_rating:post_ratings(total_score)
            )
          `)
          .gte('created_at', lookbackTimestamp)
          .is('final_position', null)

        if (strategy.scoreThreshold > 0) {
          query = query.gte('fact_check_score', strategy.scoreThreshold)
        }

        const { data: availableArticles, error } = await query

        if (error) {
          console.error(`[Secondary Selection] Query error:`, error.message)
          continue
        }

        if (!availableArticles || availableArticles.length === 0) {
          console.log(`[Secondary Selection] No articles found with ${strategy.description}`)
          continue
        }

        const newArticles = availableArticles
          .filter((article: any) => !selectedIds.has(article.id))
          .map((article: any) => ({
            id: article.id,
            current_issue_id: article.issue_id,
            score: article.rss_post?.post_rating?.[0]?.total_score || 0,
            created_at: article.created_at
          }))
          .sort((a, b) => b.score - a.score)

        const needed = finalArticleCount - selectedArticles.length
        const toAdd = newArticles.slice(0, needed)

        if (toAdd.length > 0) {
          console.log(`[Secondary Selection] Found ${toAdd.length} additional articles with ${strategy.description}`)
          toAdd.forEach((a) => {
            selectedArticles.push(a)
            selectedIds.add(a.id)
          })
        }
      }

      if (selectedArticles.length === 0) {
        console.log(`[Secondary Selection] No articles found after all fallback attempts`)
        return
      }

      selectedArticles.sort((a, b) => b.score - a.score)

      console.log(`[Secondary Selection] Final selection: ${selectedArticles.length}/${finalArticleCount} articles (sorted by score):`)
      selectedArticles.forEach((a, idx) => {
        console.log(`  ${idx + 1}. Article ${a.id} - Score: ${a.score}`)
      })

      if (selectedArticles.length < finalArticleCount) {
        console.log(`[Secondary Selection] ⚠ Warning: Only ${selectedArticles.length} articles available, target was ${finalArticleCount}`)
      }

      for (let i = 0; i < selectedArticles.length; i++) {
        const article = selectedArticles[i]

        await supabaseAdmin
          .from('secondary_articles')
          .update({
            issue_id: issueId,
            is_active: true,
            rank: i + 1 + manualArticlesUsed
          })
          .eq('id', article.id)
      }

      console.log(`[Secondary Selection] ✓ Activated ${selectedArticles.length} RSS secondary articles for issue (ranks ${manualArticlesUsed + 1}-${manualArticlesUsed + selectedArticles.length})`)

    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error selecting top secondary articles:', errorMsg)
    }
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
