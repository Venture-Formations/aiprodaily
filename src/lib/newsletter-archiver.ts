import { supabaseAdmin } from './supabase'
import type { ArchivedNewsletter } from '@/types/database'

interface ArchiveNewsletterParams {
  campaignId: string
  campaignDate: string  // YYYY-MM-DD format
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
      const { campaignId, campaignDate, subjectLine, recipientCount, htmlContent } = params

      console.log(`Archiving newsletter for campaign ${campaignId} (${campaignDate})...`)

      // 1. Fetch campaign data (including welcome section and newsletter_id)
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('newsletter_id, welcome_intro, welcome_tagline, welcome_summary')
        .eq('id', campaignId)
        .single()

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError)
        return { success: false, error: `Failed to fetch campaign: ${campaignError.message}` }
      }

      // 2. Fetch all articles for this campaign
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
        .eq('campaign_id', campaignId)
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
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      // 3. Fetch additional sections data
      const sections: Record<string, any> = {}

      // Welcome section
      if (campaign && (campaign.welcome_intro || campaign.welcome_tagline || campaign.welcome_summary)) {
        // Prepend personalized greeting to intro for email
        const greeting = 'Hey, {$name|default('Accounting Pro')}!'
        const intro = campaign.welcome_intro || ''
        const fullIntro = intro.trim() ? `${greeting} ${intro.trim()}` : greeting

        sections.welcome = {
          intro: greeting,
          tagline: campaign.welcome_tagline || '',
          summary: campaign.welcome_summary || ''
        }
      }

      // Road Work section
      const { data: roadWork } = await supabaseAdmin
        .from('road_work_data')
        .select('*')
        .eq('campaign_id', campaignId)
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
        .from('campaign_ai_app_selections')
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
        .eq('campaign_id', campaignId)
        .order('selection_order', { ascending: true })

      if (aiApps && aiApps.length > 0) {
        sections.ai_apps = aiApps
      }

      // Poll section
      const { data: poll } = await supabaseAdmin
        .from('poll_questions')
        .select('*')
        .eq('campaign_id', campaignId)
        .single()

      if (poll) {
        sections.poll = poll
      }

      // Prompt Ideas section
      const { data: promptSelection } = await supabaseAdmin
        .from('campaign_prompt_selections')
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
        .eq('campaign_id', campaignId)
        .single()

      if (promptSelection && promptSelection.prompt) {
        sections.prompt = promptSelection.prompt
      }

      // 4. Gather metadata
      const metadata = {
        total_articles: articles?.length || 0,
        total_secondary_articles: secondaryArticles?.length || 0,
        has_welcome: !!(campaign?.welcome_intro || campaign?.welcome_tagline || campaign?.welcome_summary),
        has_road_work: !!roadWork,
        has_ai_apps: !!aiApps && aiApps.length > 0,
        has_poll: !!poll,
        has_prompt: !!promptSelection,
        archived_at: new Date().toISOString()
      }

      // 5. Create archive record
      const archiveData: Partial<ArchivedNewsletter> = {
        campaign_id: campaignId,
        newsletter_id: campaign.newsletter_id,
        campaign_date: campaignDate,
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

      console.log(`✓ Newsletter archived successfully: ${campaignDate}`)
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
        .eq('campaign_date', date)
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
  async getArchiveList(limit = 50): Promise<Array<Pick<ArchivedNewsletter, 'id' | 'campaign_date' | 'subject_line' | 'send_date' | 'metadata'>>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('archived_newsletters')
        .select('id, campaign_date, subject_line, send_date, metadata')
        .order('campaign_date', { ascending: false })
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
  async updateArchive(campaignId: string, updates: Partial<ArchivedNewsletter>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('archived_newsletters')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)

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
