import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { issueWithArticles, issueWithEvents, Article } from '@/types/database'
import {
  generateNewsletterHeader,
  generateNewsletterFooter,
  generateWelcomeSection,
  generatePollSection,
  generateAdvertorialSection
} from './newsletter-templates'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

const mailerliteClient = axios.create({
  baseURL: MAILERLITE_API_BASE,
  headers: {
    'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

export class MailerLiteService {
  private errorHandler: ErrorHandler
  private slack: SlackNotificationService

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.slack = new SlackNotificationService()
  }

  async createReviewissue(issue: issueWithEvents, forcedSubjectLine?: string) {
    try {
      console.log(`Creating review issue for ${issue.date}`)

      // Get newsletter slug for issue naming
      const { data: dbissue } = await supabaseAdmin
        .from('publication_issues')
        .select('newsletters(slug)')
        .eq('id', issue.id)
        .single()

      const newsletterSlug = (dbissue as any)?.newsletters?.slug || 'accounting'
      const newsletterName = newsletterSlug.charAt(0).toUpperCase() + newsletterSlug.slice(1)

      // Get sender and group settings from database
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['email_senderName', 'email_fromEmail', 'email_reviewGroupId', 'subject_line_emoji'])

      const settingsMap = (settings || []).reduce((acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      }, {} as Record<string, string>)

      const senderName = settingsMap['email_senderName'] || 'St. Cloud Scoop'
      const fromEmail = settingsMap['email_fromEmail'] || 'scoop@stcscoop.com'
      const reviewGroupId = settingsMap['email_reviewGroupId']
      const subjectEmoji = settingsMap['subject_line_emoji'] || '🧮'

      if (!reviewGroupId) {
        throw new Error('Review Group ID not configured in database settings')
      }

      console.log('Using database settings:', { senderName, fromEmail, reviewGroupId })

      const emailContent = await this.generateEmailHTML(issue, true)

      // Log subject line status
      console.log('issue subject line:', issue.subject_line)
      console.log('Forced subject line parameter:', forcedSubjectLine)

      // Use forced subject line if provided, otherwise fall back to issue subject line
      const subjectLine = forcedSubjectLine || issue.subject_line || `Newsletter Review - ${new Date(issue.date).toLocaleDateString()}`

      console.log('Final subject line being sent to MailerLite:', subjectLine)

      const issueData = {
        name: `${newsletterName} Review: ${issue.date}`,
        type: 'regular',
        emails: [{
          subject: `${subjectEmoji} ${subjectLine}`,
          from_name: senderName,
          from: fromEmail,
          content: emailContent,
        }],
        groups: [reviewGroupId]
        // Note: Removed delivery_schedule - we'll schedule separately after creation
      }

      console.log('Sending MailerLite API request with data:', JSON.stringify(issueData, null, 2))

      const response = await mailerliteClient.post('/campaigns', issueData)

      console.log('[MailerLite] Full create review campaign response:', JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      }, null, 2))

      if (response.status === 201) {
        const issueId = response.data.data.id
        console.log('[MailerLite] Extracted review campaign ID:', issueId)
        console.log('[MailerLite] ID type:', typeof issueId)
        console.log('[MailerLite] Full response.data structure:', {
          hasData: !!response.data.data,
          dataKeys: response.data.data ? Object.keys(response.data.data) : [],
          fullData: response.data.data
        })
        console.log('issue created successfully with ID:', issueId)

        // Step 2: Schedule the issue using the issue ID
        let scheduleData
        try {
          // Schedule review for TODAY at scheduled send time
          // issue is created at issue Creation Time (8:50pm) and scheduled to send same day at Scheduled Send Time
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          scheduleData = await this.getReviewScheduleData(today)
          console.log('Scheduling review issue for today with data:', scheduleData)

          const scheduleResponse = await mailerliteClient.post(`/campaigns/${issueId}/schedule`, scheduleData)

          console.log('MailerLite schedule response:', {
            status: scheduleResponse.status,
            statusText: scheduleResponse.statusText,
            data: scheduleResponse.data
          })

          if (scheduleResponse.status === 200 || scheduleResponse.status === 201) {
            console.log('issue scheduled successfully')
          } else {
            console.error('Failed to schedule issue:', scheduleResponse.status, scheduleResponse.data)
          }
        } catch (scheduleError) {
          console.error('Error scheduling issue:', scheduleError)

          // Log detailed error information for debugging
          if (scheduleError && typeof scheduleError === 'object' && 'response' in scheduleError) {
            const axiosError = scheduleError as any
            console.error('MailerLite schedule API error response:', {
              status: axiosError.response?.status,
              statusText: axiosError.response?.statusText,
              data: axiosError.response?.data,
              config: {
                url: axiosError.config?.url,
                method: axiosError.config?.method,
                data: axiosError.config?.data
              }
            })

            // Log to database for persistent tracking
            await this.logError('Failed to schedule review issue', {
              issueId: issue.id,
              mailerliteissueId: issueId,
              scheduleData,
              errorStatus: axiosError.response?.status,
              errorData: axiosError.response?.data
            })
          }

          // Don't fail the whole process if scheduling fails - issue is still created
        }

        // Store MailerLite issue ID in email_metrics table
        // Check if metrics record exists first
        const { data: existingMetrics } = await supabaseAdmin
          .from('email_metrics')
          .select('id')
          .eq('issue_id', issue.id)
          .single()

        if (existingMetrics) {
          // Update existing record
          const { error: updateError } = await supabaseAdmin
            .from('email_metrics')
            .update({ mailerlite_issue_id: issueId })
            .eq('id', existingMetrics.id)

          if (updateError) {
            console.error('Failed to update MailerLite issue ID:', updateError)
          } else {
            console.log(`Updated MailerLite issue ID ${issueId} in email_metrics`)
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabaseAdmin
            .from('email_metrics')
            .insert({
              issue_id: issue.id,
              mailerlite_issue_id: issueId
            })

          if (insertError) {
            console.error('Failed to insert MailerLite issue ID:', insertError)
          } else {
            console.log(`Stored MailerLite issue ID ${issueId} in email_metrics`)
          }
        }

        // Update issue with review sent timestamp
        await supabaseAdmin
          .from('publication_issues')
          .update({
            status: 'in_review',
            review_sent_at: new Date().toISOString()
          })
          .eq('id', issue.id)

        await this.errorHandler.logInfo('Review issue created successfully', {
          issueId: issue.id,
          mailerliteissueId: issueId
        }, 'mailerlite_service')

        await this.slack.sendEmailIssueAlert('review', true, issue.id)

        return { success: true, issueId }
      }

      throw new Error('Failed to create review issue')

    } catch (error) {
      console.error('MailerLite API error details:', error)

      // Extract more specific error information
      let errorMessage = 'Unknown error'
      let errorDetails = {}

      if (error instanceof Error) {
        errorMessage = error.message
        if ('response' in error && error.response) {
          const axiosError = error as any
          console.error('MailerLite API error response:', {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
            headers: axiosError.response?.headers
          })
          errorDetails = {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            apiError: axiosError.response?.data
          }
          errorMessage = `MailerLite API Error: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`
        }
      }

      await this.errorHandler.handleError(error, {
        source: 'mailerlite_service',
        operation: 'createReviewissue',
        issueId: issue.id,
        errorDetails
      })
      await this.slack.sendEmailIssueAlert('review', false, issue.id, errorMessage)
      throw new Error(errorMessage)
    }
  }


  async importissueMetrics(issueId: string) {
    try {
      console.log(`[MailerLite] Fetching email_metrics for issue ${issueId}...`)
      const { data: metrics, error: metricsError } = await supabaseAdmin
        .from('email_metrics')
        .select('mailerlite_issue_id')
        .eq('issue_id', issueId)
        .single()

      if (metricsError) {
        console.error(`[MailerLite] Error fetching email_metrics:`, metricsError)
        throw new Error(`Failed to fetch email_metrics: ${metricsError.message}`)
      }

      if (!metrics?.mailerlite_issue_id) {
        console.log(`[MailerLite] No mailerlite_issue_id found for issue ${issueId}`)
        throw new Error('MailerLite issue ID not found')
      }

      const mailerliteCampaignId = metrics.mailerlite_issue_id
      console.log(`[MailerLite] Found mailerlite_issue_id: ${mailerliteCampaignId} for issue ${issueId}`)
      
      // Try multiple possible endpoints for campaign reports
      // MailerLite API might use different endpoint formats
      let response
      let lastError: any = null
      
      // Try endpoint 1: /campaigns/{id}/reports (current)
      try {
        console.log(`[MailerLite] Trying endpoint: /campaigns/${mailerliteCampaignId}/reports`)
        response = await mailerliteClient.get(`/campaigns/${mailerliteCampaignId}/reports`)
        console.log(`[MailerLite] Success with /reports endpoint`)
      } catch (error: any) {
        lastError = error
        console.log(`[MailerLite] /reports endpoint failed: ${error?.response?.status} ${error?.response?.statusText}`)
        console.log(`[MailerLite] Error response data:`, JSON.stringify(error?.response?.data, null, 2))
        
        // Try endpoint 2: /campaigns/{id} (stats might be included in campaign data)
        try {
          console.log(`[MailerLite] Trying alternative endpoint: /campaigns/${mailerliteCampaignId}`)
          const campaignResponse = await mailerliteClient.get(`/campaigns/${mailerliteCampaignId}`)
          console.log(`[MailerLite] Campaign data keys:`, Object.keys(campaignResponse.data?.data || {}))
          console.log(`[MailerLite] Full campaign response:`, JSON.stringify(campaignResponse.data, null, 2))
          
          // Check if stats are in the campaign response
          if (campaignResponse.data?.data?.stats || campaignResponse.data?.data?.statistics) {
            console.log(`[MailerLite] Found stats in campaign data`)
            response = campaignResponse // Use this response
          } else {
            throw new Error('Stats not found in campaign response')
          }
        } catch (campaignError: any) {
          console.log(`[MailerLite] /campaigns/{id} endpoint also failed: ${campaignError?.response?.status}`)
          console.log(`[MailerLite] Campaign error response:`, JSON.stringify(campaignError?.response?.data, null, 2))
          
          // Handle 404 - but now we know campaigns exist, so this is likely an endpoint issue
          if (error?.response?.status === 404) {
            console.error(`[MailerLite] Campaign ${mailerliteCampaignId} exists but reports endpoint returns 404`)
            console.error(`[MailerLite] This suggests the reports endpoint format may be incorrect`)
            console.error(`[MailerLite] Full error:`, JSON.stringify({
              url: error.config?.url,
              method: error.config?.method,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }, null, 2))
            
            // Don't clear the ID - campaigns exist, this is an API endpoint issue
            throw new Error(`Campaign exists but reports endpoint not found. Possible API format change. Status: 404`)
          }
          throw error // Re-throw original error
        }
      }

      console.log(`[MailerLite] Response status: ${response.status} for campaign ${mailerliteCampaignId}`)

      if (response.status === 200) {
        const data = response.data.data
        
        // Handle different response formats
        // Format 1: Direct reports endpoint (data contains stats directly)
        // Format 2: Campaign endpoint (data.stats or data.statistics contains stats)
        let stats = data
        
        if (data.stats) {
          console.log(`[MailerLite] Found stats in data.stats`)
          stats = data.stats
        } else if (data.statistics) {
          console.log(`[MailerLite] Found stats in data.statistics`)
          stats = data.statistics
        }
        
        console.log(`[MailerLite] Received metrics data for campaign ${mailerliteCampaignId}:`, {
          sent: stats.sent,
          delivered: stats.delivered,
          opened: stats.opened?.count || stats.opened,
          clicked: stats.clicked?.count || stats.clicked
        })
        console.log(`[MailerLite] Full stats object:`, JSON.stringify(stats, null, 2))

        const metricsUpdate = {
          sent_count: stats.sent || 0,
          delivered_count: stats.delivered || 0,
          opened_count: stats.opened?.count || stats.opened || 0,
          clicked_count: stats.clicked?.count || stats.clicked || 0,
          bounced_count: stats.bounced?.count || stats.bounced || 0,
          unsubscribed_count: stats.unsubscribed?.count || stats.unsubscribed || 0,
          open_rate: stats.opened?.rate || stats.open_rate || 0,
          click_rate: stats.clicked?.rate || stats.click_rate || 0,
          bounce_rate: stats.bounced?.rate || stats.bounce_rate || 0,
          unsubscribe_rate: stats.unsubscribed?.rate || stats.unsubscribe_rate || 0,
        }

        const { error: updateError } = await supabaseAdmin
          .from('email_metrics')
          .update(metricsUpdate)
          .eq('issue_id', issueId)

        if (updateError) {
          console.error(`[MailerLite] Error updating metrics for issue ${issueId}:`, updateError)
          throw new Error(`Failed to update metrics: ${updateError.message}`)
        }

        console.log(`[MailerLite] Successfully updated metrics for issue ${issueId}`)
        return metricsUpdate
      }

      console.error(`[MailerLite] Unexpected response status ${response.status} for campaign ${mailerliteCampaignId}`)
      throw new Error(`Failed to fetch metrics from MailerLite: Status ${response.status}`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[MailerLite] Error importing metrics for issue ${issueId}:`, errorMessage)
      
      // Log more details if it's an Axios error
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any
        console.error(`[MailerLite] Axios error details:`, {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          url: axiosError.config?.url
        })
      }

      await this.logError('Failed to import issue metrics', {
        issueId,
        error: errorMessage
      })
      throw error
    }
  }


  private async generateEmailHTML(issue: issueWithEvents, isReview: boolean): Promise<string> {
    // Filter active articles and sort by rank (custom order)
    const activeArticles = issue.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    console.log('MAILERLITE - Active articles to render:', activeArticles.length)
    console.log('MAILERLITE - Article order:', activeArticles.map(a => `${a.headline} (rank: ${a.rank})`).join(', '))

    // Fetch newsletter sections order
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    console.log('MailerLite - Active newsletter sections:', sections?.map(s => `${s.name} (order: ${s.display_order})`).join(', '))

    // Format date using local date parsing (same as preview)
    const [year, month, day] = issue.date.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Use the modular template functions with tracking - SAME AS PREVIEW
    // mailerlite_issue_id might not exist yet during review, so it's optional
    const mailerliteId = (issue as any).mailerlite_issue_id || undefined
    const header = await generateNewsletterHeader(formattedDate, issue.date, mailerliteId)
    const footer = await generateNewsletterFooter(issue.date, mailerliteId)

    // Generate welcome section (if it exists)
    const welcomeHtml = await generateWelcomeSection(
      issue.welcome_intro || null,
      issue.welcome_tagline || null,
      issue.welcome_summary || null
    )

    // Review banner for review issues
    const reviewBanner = isReview ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin: 10px auto; max-width: 750px; background-color: #FEF3C7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 12px; text-align: center;">
      <h3 style="margin: 0; color: #92400E; font-size: 18px; font-weight: bold;">📝 Newsletter Review</h3>
      <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">
        This is a preview of tomorrow's newsletter. Please review and make any necessary changes in the dashboard.
      </p>
    </td>
  </tr>
</table>
<br>` : ''

    // Section ID constants (stable across name changes) - SAME AS PREVIEW
    const SECTION_IDS = {
      AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
      PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
      ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d'
    }

    // Generate sections in order based on database configuration - SAME AS PREVIEW
    let sectionsHtml = ''
    if (sections && sections.length > 0) {
      for (const section of sections) {
        // Check if this is a primary articles section (display_order 3)
        if (section.display_order === 3 && activeArticles.length > 0) {
          const { generatePrimaryArticlesSection } = await import('./newsletter-templates')
          const primaryHtml = await generatePrimaryArticlesSection(activeArticles, issue.date, issue.id, section.name)
          sectionsHtml += primaryHtml
        }
        // Check if this is a secondary articles section (display_order 5)
        else if (section.display_order === 5) {
          const { generateSecondaryArticlesSection } = await import('./newsletter-templates')
          const secondaryHtml = await generateSecondaryArticlesSection(issue, section.name)
          sectionsHtml += secondaryHtml
        }
        // Use section ID for AI Applications (stable across name changes)
        else if (section.id === SECTION_IDS.AI_APPLICATIONS) {
          const { generateAIAppsSection } = await import('./newsletter-templates')
          const aiAppsHtml = await generateAIAppsSection(issue)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        // Use section ID for Prompt Ideas (stable across name changes)
        else if (section.id === SECTION_IDS.PROMPT_IDEAS) {
          const { generatePromptIdeasSection } = await import('./newsletter-templates')
          const promptHtml = await generatePromptIdeasSection(issue)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        // Legacy name-based matching for other sections
        else if (section.name === 'Poll') {
          const pollHtml = await generatePollSection(issue.id)
          if (pollHtml) {
            sectionsHtml += pollHtml
          }
        } else if (section.name === 'Breaking News') {
          const { generateBreakingNewsSection } = await import('./newsletter-templates')
          const breakingNewsHtml = await generateBreakingNewsSection(issue)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        } else if (section.name === 'Beyond the Feed') {
          const { generateBeyondTheFeedSection } = await import('./newsletter-templates')
          const beyondFeedHtml = await generateBeyondTheFeedSection(issue)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
        // Use section ID for Advertisement (stable across name changes)
        else if (section.id === SECTION_IDS.ADVERTISEMENT) {
          const advertorialHtml = await generateAdvertorialSection(issue, !isReview, section.name) // Record usage for final issues only, pass section name
          if (advertorialHtml) {
            sectionsHtml += advertorialHtml
          }
        }
      }
    } else {
      // Fallback to default order if no sections configured
      console.log('MailerLite - No sections found, using default order')
      sectionsHtml = ''
    }

    // Combine using the SAME template structure as preview (welcome section goes after header)
    return reviewBanner + header + welcomeHtml + sectionsHtml + footer
  }


  private async getReviewScheduleData(date: string): Promise<any> {
    try {
      // Get scheduled send time from database settings
      const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'email_scheduledSendTime')
        .single()

      const scheduledTime = setting?.value || '21:00' // Default to 9:00 PM if not found
      console.log('Using scheduled send time from settings:', scheduledTime)

      // Parse the time (format: "HH:MM")
      const [hours, minutes] = scheduledTime.split(':')

      // MailerLite scheduling format
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // YYYY-MM-DD format
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: 157 // Central Time zone ID (based on your Make.com example)
        }
      }

      console.log('MailerLite schedule data:', JSON.stringify(scheduleData, null, 2))
      return scheduleData

    } catch (error) {
      console.error('Error getting review schedule data, using default:', error)
      // Fallback to 9:00 PM CT
      return {
        delivery: 'scheduled',
        schedule: {
          date: date,
          hours: '21',
          minutes: '00',
          timezone_id: 157
        }
      }
    }
  }

  private async getFinalScheduleData(date: string): Promise<any> {
    try {
      // Get final send time from database settings
      const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'email_dailyScheduledSendTime')
        .single()

      const finalTime = setting?.value || '04:55' // Default to 4:55 AM if not found
      console.log('Using daily scheduled send time from settings:', finalTime)

      // Parse the time (format: "HH:MM")
      const [hours, minutes] = finalTime.split(':')

      // MailerLite scheduling format for final issue
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // Newsletter date (YYYY-MM-DD format)
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: 157 // Central Time zone ID
        }
      }

      console.log('Final issue schedule data:', JSON.stringify(scheduleData, null, 2))
      return scheduleData

    } catch (error) {
      console.error('Error getting final schedule data, using default:', error)
      // Fallback to 4:55 AM CT on the newsletter date
      return {
        delivery: 'scheduled',
        schedule: {
          date: date,
          hours: '04',
          minutes: '55',
          timezone_id: 157
        }
      }
    }
  }

  async createFinalissue(issue: issueWithEvents, mainGroupId: string) {
    try {
      console.log(`Creating final issue for ${issue.date}`)

      // Get newsletter slug for issue naming
      const { data: dbissue } = await supabaseAdmin
        .from('publication_issues')
        .select('newsletters(slug)')
        .eq('id', issue.id)
        .single()

      const newsletterSlug = (dbissue as any)?.newsletters?.slug || 'accounting'
      const newsletterName = newsletterSlug.charAt(0).toUpperCase() + newsletterSlug.slice(1)

      // Get sender settings
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['email_senderName', 'email_fromEmail', 'subject_line_emoji'])

      const settingsMap = (settings || []).reduce((acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      }, {} as Record<string, string>)

      const senderName = settingsMap['email_senderName'] || 'St. Cloud Scoop'
      const fromEmail = settingsMap['email_fromEmail'] || 'scoop@stcscoop.com'
      const subjectEmoji = settingsMap['subject_line_emoji'] || '🧮'

      const emailContent = await this.generateEmailHTML(issue, false) // Not a review

      const subjectLine = issue.subject_line || `Newsletter - ${new Date(issue.date).toLocaleDateString()}`

      console.log('Creating final issue with subject line:', subjectLine)
      console.log('Using sender settings:', { senderName, fromEmail })

      const issueData = {
        name: `${newsletterName} Newsletter: ${issue.date}`,
        type: 'regular',
        emails: [{
          subject: `${subjectEmoji} ${subjectLine}`,
          from_name: senderName,
          from: fromEmail,
          content: emailContent,
        }],
        groups: [mainGroupId]
      }

      console.log('Creating MailerLite issue with data:', {
        name: issueData.name,
        subject: issueData.emails[0].subject,
        groupId: mainGroupId
      })

      const response = await mailerliteClient.post('/campaigns', issueData)

      console.log('[MailerLite] Full create campaign response:', JSON.stringify({
        status: response.status,
        headers: response.headers,
        data: response.data
      }, null, 2))

      if (response.data && response.data.data && response.data.data.id) {
        const issueId = response.data.data.id

        console.log('[MailerLite] Extracted campaign ID:', issueId)
        console.log('[MailerLite] ID type:', typeof issueId)
        console.log('[MailerLite] Full response.data structure:', {
          hasData: !!response.data.data,
          dataKeys: response.data.data ? Object.keys(response.data.data) : [],
          fullData: response.data.data
        })

        console.log('Final issue created successfully:', issueId)

        // Schedule the final issue for TODAY at scheduled send time
        // issue is created at issue Creation Time and scheduled to send same day at Scheduled Send Time
        try {
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          const finalScheduleData = await this.getFinalScheduleData(today)
          console.log('Scheduling final issue for today with data:', finalScheduleData)

          const scheduleResponse = await mailerliteClient.post(`/campaigns/${issueId}/schedule`, finalScheduleData)

          console.log('Final issue schedule response:', {
            status: scheduleResponse.status,
            statusText: scheduleResponse.statusText,
            data: scheduleResponse.data
          })

          if (scheduleResponse.status === 200 || scheduleResponse.status === 201) {
            console.log('Final issue scheduled successfully')
          } else {
            console.error('Failed to schedule final issue:', scheduleResponse.status, scheduleResponse.data)
          }
        } catch (scheduleError) {
          console.error('Error scheduling final issue:', scheduleError)

          // Log detailed error information for debugging
          if (scheduleError && typeof scheduleError === 'object' && 'response' in scheduleError) {
            const axiosError = scheduleError as any
            console.error('MailerLite final schedule API error response:', {
              status: axiosError.response?.status,
              statusText: axiosError.response?.statusText,
              data: axiosError.response?.data,
              config: {
                url: axiosError.config?.url,
                method: axiosError.config?.method,
                data: axiosError.config?.data
              }
            })

            // Log to database for persistent tracking
            const finalScheduleData = await this.getFinalScheduleData(issue.date)
            await this.logError('Failed to schedule final issue', {
              issueId: issue.id,
              mailerliteissueId: issueId,
              scheduleData: finalScheduleData,
              errorStatus: axiosError.response?.status,
              errorData: axiosError.response?.data
            })
          }

          // Don't fail the whole process if scheduling fails - issue is still created
        }

        // Store MailerLite issue ID in email_metrics table
        // Check if metrics record exists first
        const { data: existingMetrics } = await supabaseAdmin
          .from('email_metrics')
          .select('id')
          .eq('issue_id', issue.id)
          .single()

        if (existingMetrics) {
          // Update existing record
          const { error: updateError } = await supabaseAdmin
            .from('email_metrics')
            .update({ mailerlite_issue_id: issueId })
            .eq('id', existingMetrics.id)

          if (updateError) {
            console.error('Failed to update MailerLite issue ID:', updateError)
          } else {
            console.log(`Updated MailerLite issue ID ${issueId} in email_metrics`)
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabaseAdmin
            .from('email_metrics')
            .insert({
              issue_id: issue.id,
              mailerlite_issue_id: issueId
            })

          if (insertError) {
            console.error('Failed to insert MailerLite issue ID:', insertError)
          } else {
            console.log(`Stored MailerLite issue ID ${issueId} in email_metrics`)
          }
        }

        await this.logInfo('Final issue created successfully', {
          issueId: issue.id,
          mailerliteissueId: issueId,
          mainGroupId: mainGroupId
        })

        await this.slack.sendEmailIssueAlert('final', true, issue.id)

        return { success: true, issueId }
      }

      throw new Error('Failed to create final issue')

    } catch (error) {
      console.error('Failed to create final issue:', error)

      if (error instanceof Error) {
        await this.logError('Failed to create final issue', {
          error: error.message,
          issueId: issue.id,
          mainGroupId: mainGroupId
        })

        await this.slack.sendEmailIssueAlert('final', false, issue.id, error.message)
      }

      throw error
    }
  }

  private async logInfo(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'info',
        message,
        context,
        source: 'mailerlite_service'
      }])
  }

  private async logError(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message,
        context,
        source: 'mailerlite_service'
      }])
  }

  async sendEventApprovalEmail(event: {
    title: string
    description: string
    start_date: string
    end_date: string | null
    venue: string | null
    address: string | null
    url: string | null
    website: string | null
    submitter_email: string
    submitter_name: string
  }) {
    try {
      const formattedStartDate = new Date(event.start_date).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      const formattedEndDate = event.end_date ? new Date(event.end_date).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) : null

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #4b5563; }
    .footer { text-align: center; color: #6b7280; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ Event Approved!</h1>
    </div>
    <div class="content">
      <p>Hi ${event.submitter_name},</p>
      <p>Great news! Your event submission has been approved and is now live on St. Cloud Scoop.</p>

      <div class="event-details">
        <h2 style="margin-top: 0; color: #1f2937;">${event.title}</h2>

        <div class="detail-row">
          <span class="label">Date & Time:</span><br>
          ${formattedStartDate}${formattedEndDate ? ` - ${formattedEndDate}` : ''}
        </div>

        ${event.venue ? `
        <div class="detail-row">
          <span class="label">Venue:</span><br>
          ${event.venue}
        </div>
        ` : ''}

        ${event.address ? `
        <div class="detail-row">
          <span class="label">Address:</span><br>
          ${event.address}
        </div>
        ` : ''}

        ${event.description ? `
        <div class="detail-row">
          <span class="label">Description:</span><br>
          ${event.description}
        </div>
        ` : ''}

        ${event.website ? `
        <div class="detail-row">
          <span class="label">Website:</span><br>
          <a href="${event.website}" style="color: #2563eb;">${event.website}</a>
        </div>
        ` : ''}
      </div>

      <p>Your event will be featured in our newsletter and on our website. Thank you for helping keep the St. Cloud community informed!</p>

      <p>Best regards,<br>The St. Cloud Scoop Team</p>

      <div class="footer">
        <p>AI Accounting Daily | <a href="https://www.aiaccountingdaily.com">www.aiaccountingdaily.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`

      const response = await mailerliteClient.post('/emails', {
        to: event.submitter_email,
        subject: `✅ Your Event "${event.title}" Has Been Approved`,
        from: {
          email: 'scoop@stcscoop.com',
          name: 'St. Cloud Scoop'
        },
        html: emailHtml
      })

      console.log('Event approval email sent:', event.submitter_email)
      return { success: true, data: response.data }

    } catch (error) {
      console.error('Error sending event approval email:', error)
      return { success: false, error }
    }
  }

  async sendEventRejectionEmail(event: {
    title: string
    description: string
    start_date: string
    submitter_email: string
    submitter_name: string
  }, reason?: string) {
    try {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Event Submission Update</h1>
    </div>
    <div class="content">
      <p>Hi ${event.submitter_name},</p>
      <p>Thank you for submitting your event to St. Cloud Scoop. After reviewing your submission, we're unable to approve it at this time.</p>

      <div class="event-details">
        <h2 style="margin-top: 0; color: #1f2937;">${event.title}</h2>
        ${event.description ? `<p>${event.description}</p>` : ''}
      </div>

      ${reason ? `
      <div class="reason-box">
        <strong>Reason:</strong><br>
        ${reason}
      </div>
      ` : ''}

      <p>If you have questions or would like to resubmit with changes, please feel free to reach out to us.</p>

      <p>Best regards,<br>The St. Cloud Scoop Team</p>

      <div class="footer">
        <p>AI Accounting Daily | <a href="https://www.aiaccountingdaily.com">www.aiaccountingdaily.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`

      const response = await mailerliteClient.post('/emails', {
        to: event.submitter_email,
        subject: `Event Submission Update: "${event.title}"`,
        from: {
          email: 'scoop@stcscoop.com',
          name: 'St. Cloud Scoop'
        },
        html: emailHtml
      })

      console.log('Event rejection email sent:', event.submitter_email)
      return { success: true, data: response.data }

    } catch (error) {
      console.error('Error sending event rejection email:', error)
      return { success: false, error }
    }
  }

  /**
   * Update a subscriber's custom field in MailerLite
   * @param email Subscriber email address
   * @param fieldName Name of the custom field (e.g., "poll_responses")
   * @param fieldValue Value to set for the field
   */
  async updateSubscriberField(email: string, fieldName: string, fieldValue: any): Promise<{ success: boolean, error?: any }> {
    try {
      console.log(`Updating MailerLite subscriber field: ${email}, ${fieldName} = ${fieldValue}`)

      // Find subscriber by email
      const searchResponse = await mailerliteClient.get(`/subscribers`, {
        params: { filter: { email } }
      })

      if (!searchResponse.data || !searchResponse.data.data || searchResponse.data.data.length === 0) {
        console.log(`Subscriber ${email} not found in MailerLite`)
        return { success: false, error: 'Subscriber not found' }
      }

      const subscriberId = searchResponse.data.data[0].id

      // Update subscriber with custom field
      const updateData = {
        fields: {
          [fieldName]: fieldValue
        }
      }

      const updateResponse = await mailerliteClient.put(`/subscribers/${subscriberId}`, updateData)

      if (updateResponse.status === 200 || updateResponse.status === 201) {
        console.log(`Successfully updated ${fieldName} for ${email}`)
        return { success: true }
      }

      console.error('Unexpected response status:', updateResponse.status)
      return { success: false, error: `Unexpected status: ${updateResponse.status}` }

    } catch (error) {
      console.error('Error updating MailerLite subscriber field:', error)
      return { success: false, error }
    }
  }
}