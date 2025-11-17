import { supabaseAdmin } from './supabase'
import type { ArchivedNewsletter } from '@/types/database'

interface ArchiveNewsletterParams {
  issueId: string
  issueDate: string  // YYYY-MM-DD format
  subjectLine: string
  recipientCount: number
  htmlContent?: string  // Optional HTML backup
}

export class NewsletterArchiver {
  /**
   * Archive a newsletter at send time
   * Captures all structured data for web rendering
   */
  async archiveNewsletter(params: ArchiveNewsletterParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { issueId, issueDate, subjectLine, recipientCount, htmlContent } = params

      console.log(`Archiving newsletter for issue ${issueId} (${issueDate})...`)

      // 1. Fetch issue data (including welcome section and publication_id)
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('publication_id, welcome_intro, welcome_tagline, welcome_summary')
        .eq('id', issueId)
        .single()

      if (issueError) {
        console.error('Error fetching issue:', issueError)
        return { success: false, error: `Failed to fetch issue: ${issueError.message}` }
      }

      // 2. Fetch all articles for this issue
      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          headline,
          content,
          word_count,
          rank,
          final_position,
          created_at,
          rss_post:rss_posts(
            title,
            source_url,
            image_url,
            publication_date
          )
        `)
        .eq('issue_id', issueId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      if (articlesError) {
        console.error('Error fetching articles:', articlesError)
        return { success: false, error: `Failed to fetch articles: ${articlesError.message}` }
      }

      // Fetch secondary articles
      const { data: secondaryArticles } = await supabaseAdmin
        .from('secondary_articles')
        .select(`
          id,
          headline,
          content,
          word_count,
          rank,
          final_position,
          created_at,
          rss_post:rss_posts(
            title,
            source_url,
            image_url,
            publication_date
          )
        `)
        .eq('issue_id', issueId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      // 3. Fetch additional sections data
      const sections: Record<string, any> = {}

      // Welcome section
      if (issue && (issue.welcome_intro || issue.welcome_tagline || issue.welcome_summary)) {
        // Prepend personalized greeting to intro for email
        const greeting = `Hey, {$name|default('Accounting Pro')}!`
        const intro = issue.welcome_intro || ''
        const fullIntro = intro.trim() ? `${greeting} ${intro.trim()}` : greeting

        sections.welcome = {
          intro: greeting,
          tagline: issue.welcome_tagline || '',
          summary: issue.welcome_summary || ''
        }
      }

      // Road Work section
      const { data: roadWork } = await supabaseAdmin
        .from('road_work_data')
        .select('*')
        .eq('issue_id', issueId)
        .eq('is_active', true)
        .single()

      if (roadWork) {
        sections.road_work = {
          items: roadWork.road_work_data,
          generated_at: roadWork.generated_at
        }
      }

      // AI Apps section
      const { data: aiApps } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select(`
          selection_order,
          is_featured,
          app:ai_applications(
            id,
            app_name,
            tagline,
            description,
            app_url,
            logo_url,
            category,
            tool_type
          )
        `)
        .eq('issue_id', issueId)
        .order('selection_order', { ascending: true })

      if (aiApps && aiApps.length > 0) {
        sections.ai_apps = aiApps
      }

      // Poll section
      const { data: poll } = await supabaseAdmin
        .from('poll_questions')
        .select('*')
        .eq('issue_id', issueId)
        .single()

      if (poll) {
        sections.poll = poll
      }

      // Prompt Ideas section
      const { data: promptSelection } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select(`
          selection_order,
          is_featured,
          prompt:prompt_ideas(
            id,
            title,
            prompt_text,
            category
          )
        `)
        .eq('issue_id', issueId)
        .single()

      if (promptSelection && promptSelection.prompt) {
        sections.prompt = promptSelection.prompt
      }

      // Advertorial section
      const { data: advertorialData } = await supabaseAdmin
        .from('issue_advertisements')
        .select(`
          issue_date,
          used_at,
          advertisement:advertisements(
            id,
            title,
            body,
            button_text,
            button_url,
            image_url
          )
        `)
        .eq('issue_id', issueId)
        .single()

      if (advertorialData && advertorialData.advertisement) {
        sections.advertorial = advertorialData.advertisement
      }

      // 4. Gather metadata
      const metadata = {
        total_articles: articles?.length || 0,
        total_secondary_articles: secondaryArticles?.length || 0,
        has_welcome: !!(issue?.welcome_intro || issue?.welcome_tagline || issue?.welcome_summary),
        has_road_work: !!roadWork,
        has_ai_apps: !!aiApps && aiApps.length > 0,
        has_poll: !!poll,
        has_prompt: !!promptSelection,
        has_advertorial: !!advertorialData,
        archived_at: new Date().toISOString()
      }

      // 5. Create archive record
      const archiveData = {
        issue_id: issueId,
        publication_id: issue.publication_id,
        issue_date: issueDate,
        subject_line: subjectLine,
        send_date: new Date().toISOString(),
        recipient_count: recipientCount,
        html_backup: htmlContent || null,
        metadata,
        articles: articles || [],
        secondary_articles: secondaryArticles || [],
        events: [], // No events support for AI Accounting Daily
        sections
      }

      const { error: insertError } = await supabaseAdmin
        .from('archived_newsletters')
        .insert(archiveData)

      if (insertError) {
        console.error('Error inserting archive:', insertError)
        return { success: false, error: `Failed to create archive: ${insertError.message}` }
      }

      console.log(`✓ Newsletter archived successfully: ${issueDate}`)
      return { success: true }

    } catch (error: any) {
      console.error('Error archiving newsletter:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get archived newsletter by date
   */
  async getArchivedNewsletter(date: string): Promise<ArchivedNewsletter | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('archived_newsletters')
        .select('*')
        .eq('issue_date', date)
        .single()

      if (error) {
        console.error('Error fetching archived newsletter:', error)
        return null
      }

      return data as ArchivedNewsletter
    } catch (error) {
      console.error('Error getting archived newsletter:', error)
      return null
    }
  }

  /**
   * Get list of all archived newsletters
   */
  async getArchiveList(limit = 50): Promise<Array<Pick<ArchivedNewsletter, 'id' | 'issue_date' | 'subject_line' | 'send_date' | 'metadata'>>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('archived_newsletters')
        .select('id, issue_date, subject_line, send_date, metadata')
        .order('issue_date', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching archive list:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting archive list:', error)
      return []
    }
  }

  /**
   * Update archive with additional data (e.g., analytics)
   */
  async updateArchive(issueId: string, updates: Partial<ArchivedNewsletter>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('archived_newsletters')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('issue_id', issueId)

      if (error) {
        console.error('Error updating archive:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Error updating archive:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const newsletterArchiver = new NewsletterArchiver()
