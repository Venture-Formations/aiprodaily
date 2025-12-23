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

      // AI Apps section - using module system (structured like ad_modules)
      // First get the AI_APPLICATIONS section display_order for proper positioning
      const { data: aiAppSection } = await supabaseAdmin
        .from('newsletter_sections')
        .select('display_order')
        .eq('section_type', 'ai_applications')
        .single()
      const aiAppSectionOrder = aiAppSection?.display_order ?? 999

      const { data: aiAppModuleSelections } = await supabaseAdmin
        .from('issue_ai_app_modules')
        .select(`
          app_ids,
          ai_app_module:ai_app_modules(
            id,
            name,
            display_order,
            block_order
          )
        `)
        .eq('issue_id', issueId)

      if (aiAppModuleSelections && aiAppModuleSelections.length > 0) {
        // Collect all app_ids to fetch apps in a single query
        const allAppIds: string[] = []
        for (const selection of aiAppModuleSelections) {
          const appIds = selection.app_ids as string[] || []
          allAppIds.push(...appIds)
        }

        // Fetch all apps at once
        let appsMap: Map<string, any> = new Map()
        if (allAppIds.length > 0) {
          const { data: apps } = await supabaseAdmin
            .from('ai_applications')
            .select('id, app_name, tagline, description, app_url, logo_url, category, tool_type')
            .in('id', allAppIds)

          if (apps) {
            appsMap = new Map(apps.map(app => [app.id, app]))
          }
        }

        // Structure AI App modules like ad_modules (with display_order and apps per module)
        sections.ai_app_modules = aiAppModuleSelections.map((selection: any) => {
          const moduleData = selection.ai_app_module as any
          const module = Array.isArray(moduleData) ? moduleData[0] : moduleData
          const appIds = selection.app_ids as string[] || []

          // Get apps for this module in order
          const moduleApps = appIds
            .map(id => appsMap.get(id))
            .filter(Boolean)

          return {
            module_id: module?.id,
            module_name: module?.name,
            // Use newsletter_sections AI_APPLICATIONS display_order for proper positioning
            display_order: aiAppSectionOrder,
            block_order: module?.block_order,
            apps: moduleApps
          }
        })

        // Also keep legacy ai_apps flat array for backwards compatibility
        if (allAppIds.length > 0) {
          const aiAppsData = allAppIds
            .map((id, index) => {
              const app = appsMap.get(id)
              return app ? { selection_order: index + 1, is_featured: false, app } : null
            })
            .filter(Boolean)

          if (aiAppsData.length > 0) {
            sections.ai_apps = aiAppsData
          }
        }
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

      // Prompt Ideas section (legacy - single prompt)
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

      // Prompt Modules section (new dynamic prompt sections)
      // First get the PROMPT_IDEAS section display_order for proper positioning
      const { data: promptSection } = await supabaseAdmin
        .from('newsletter_sections')
        .select('display_order')
        .eq('section_type', 'prompt_ideas')
        .single()
      const promptSectionOrder = promptSection?.display_order ?? 999

      const { data: promptModuleSelections } = await supabaseAdmin
        .from('issue_prompt_modules')
        .select(`
          selected_at,
          used_at,
          prompt_module:prompt_modules(
            id,
            name,
            display_order,
            block_order
          ),
          prompt:prompt_ideas(
            id,
            title,
            prompt_text,
            category
          )
        `)
        .eq('issue_id', issueId)

      if (promptModuleSelections && promptModuleSelections.length > 0) {
        sections.prompt_modules = promptModuleSelections.map((selection: any) => ({
          module_id: selection.prompt_module?.id,
          module_name: selection.prompt_module?.name,
          // Use newsletter_sections PROMPT_IDEAS display_order for proper positioning
          display_order: promptSectionOrder,
          block_order: selection.prompt_module?.block_order,
          selected_at: selection.selected_at,
          used_at: selection.used_at,
          prompt: selection.prompt ? {
            id: selection.prompt.id,
            title: selection.prompt.title,
            prompt_text: selection.prompt.prompt_text,
            category: selection.prompt.category
          } : null
        }))
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

      // Ad Modules section (new dynamic ad sections)
      // Uses unified advertisements table
      const { data: adModuleSelections } = await supabaseAdmin
        .from('issue_module_ads')
        .select(`
          selection_mode,
          selected_at,
          used_at,
          ad_module:ad_modules(
            id,
            name,
            display_order,
            block_order
          ),
          advertisement:advertisements(
            id,
            title,
            body,
            image_url,
            button_text,
            button_url,
            company_name,
            advertiser:advertisers(
              id,
              company_name,
              logo_url,
              website_url
            )
          )
        `)
        .eq('issue_id', issueId)

      if (adModuleSelections && adModuleSelections.length > 0) {
        sections.ad_modules = adModuleSelections.map((selection: any) => ({
          module_id: selection.ad_module?.id,
          module_name: selection.ad_module?.name,
          display_order: selection.ad_module?.display_order,
          block_order: selection.ad_module?.block_order,
          selection_mode: selection.selection_mode,
          selected_at: selection.selected_at,
          used_at: selection.used_at,
          ad: selection.advertisement ? {
            id: selection.advertisement.id,
            title: selection.advertisement.title,
            body: selection.advertisement.body,
            image_url: selection.advertisement.image_url,
            button_text: selection.advertisement.button_text,
            button_url: selection.advertisement.button_url,
            company_name: selection.advertisement.company_name || selection.advertisement.advertiser?.company_name,
            company_logo: selection.advertisement.advertiser?.logo_url,
            company_url: selection.advertisement.advertiser?.website_url
          } : null
        }))
      }

      // Poll Modules section (new dynamic poll sections)
      const { data: pollModuleSelections } = await supabaseAdmin
        .from('issue_poll_modules')
        .select(`
          selected_at,
          used_at,
          poll_snapshot,
          poll_module:poll_modules(
            id,
            name,
            display_order,
            block_order
          ),
          poll:polls(
            id,
            title,
            question,
            options,
            image_url
          )
        `)
        .eq('issue_id', issueId)

      if (pollModuleSelections && pollModuleSelections.length > 0) {
        sections.poll_modules = pollModuleSelections.map((selection: any) => ({
          module_id: selection.poll_module?.id,
          module_name: selection.poll_module?.name,
          display_order: selection.poll_module?.display_order,
          block_order: selection.poll_module?.block_order,
          selected_at: selection.selected_at,
          used_at: selection.used_at,
          poll: selection.poll_snapshot || (selection.poll ? {
            id: selection.poll.id,
            title: selection.poll.title,
            question: selection.poll.question,
            options: selection.poll.options,
            image_url: selection.poll.image_url
          } : null)
        }))
      }

      // Newsletter sections configuration snapshot (for section ordering)
      const { data: newsletterSections } = await supabaseAdmin
        .from('newsletter_sections')
        .select('id, name, display_order, section_type, is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (newsletterSections && newsletterSections.length > 0) {
        sections.newsletter_sections = newsletterSections.map((s: any) => ({
          id: s.id,
          name: s.name,
          display_order: s.display_order,
          section_type: s.section_type,
          is_active: s.is_active
        }))
      }

      // 4. Gather metadata
      const metadata = {
        total_articles: articles?.length || 0,
        total_secondary_articles: secondaryArticles?.length || 0,
        has_welcome: !!(issue?.welcome_intro || issue?.welcome_tagline || issue?.welcome_summary),
        has_road_work: !!roadWork,
        has_ai_apps: !!sections.ai_apps && Array.isArray(sections.ai_apps) && sections.ai_apps.length > 0,
        has_ai_app_modules: !!sections.ai_app_modules && Array.isArray(sections.ai_app_modules) && sections.ai_app_modules.length > 0,
        ai_app_modules_count: sections.ai_app_modules?.length || 0,
        has_poll: !!poll,
        has_prompt: !!promptSelection,
        has_prompt_modules: !!promptModuleSelections && promptModuleSelections.length > 0,
        prompt_modules_count: promptModuleSelections?.length || 0,
        has_advertorial: !!advertorialData,
        has_ad_modules: !!adModuleSelections && adModuleSelections.length > 0,
        ad_modules_count: adModuleSelections?.length || 0,
        has_poll_modules: !!pollModuleSelections && pollModuleSelections.length > 0,
        poll_modules_count: pollModuleSelections?.length || 0,
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
