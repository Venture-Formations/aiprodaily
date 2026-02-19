import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { issueWithArticles, issueWithEvents, Article } from '@/types/database'
import { generateFullNewsletterHtml } from './newsletter-templates'
import { getEmailSettings, getScheduleSettings, getPublicationSetting, getPublicationSettings } from './publication-settings'

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

  /**
   * Generate plain text version of the newsletter for email clients that can't render HTML.
   * Uses the newsletter name and business info from publication settings.
   */
  private async generatePlainText(publicationId: string, senderName: string): Promise<string> {
    const settings = await getPublicationSettings(publicationId, [
      'newsletter_name',
      'business_name',
      'business_address',
    ])

    const newsletterName = settings.newsletter_name || senderName
    const businessName = settings.business_name || 'Venture Formations LLC'
    const businessAddress = settings.business_address || '8250 Delta Circle, Saint Joseph, MN 56374'
    const currentYear = new Date().getFullYear()

    // Parse address parts (format: "Street, City, ST ZIP")
    const addressParts = businessAddress.split(',').map((p: string) => p.trim())
    const street = addressParts[0] || ''
    const cityStateZip = addressParts.slice(1).join(', ') || ''

    return `GM!

You're receiving this because you subscribed to ${newsletterName}.
Your email software currently can't display our full HTML layout.

>> VIEW TODAY'S FULL EDITION IN YOUR BROWSER:
{$url}

------------------------------------------------------------
   UNSUBSCRIBE
------------------------------------------------------------
If you no longer wish to receive these updates, you can
instantly opt-out here:
{$unsubscribe}

------------------------------------------------------------
   CONTACT US
------------------------------------------------------------
${newsletterName}
${businessName}
${street}
${cityStateZip}
United States

\u00A9${currentYear} ${businessName}. All rights reserved.`
  }

  /**
   * Push HTML content, plain text, and auto_inline setting to a campaign
   * via the MailerLite content endpoint (PUT /campaigns/{id}/content).
   */
  private async pushCampaignContent(campaignId: string, html: string, plain: string): Promise<void> {
    // Attempt to push plain text + auto_inline via the undocumented content endpoint.
    // Content is ALREADY set via the POST, so this is a non-fatal enhancement attempt.
    try {
      const contentResponse = await mailerliteClient.put(`/campaigns/${campaignId}/content`, {
        html,
        plain,
        auto_inline: true,
      })

      console.log('[MailerLite] Content push response:', {
        status: contentResponse.status,
        statusText: contentResponse.statusText,
        data: JSON.stringify(contentResponse.data).substring(0, 200),
      })
    } catch (contentError: any) {
      console.error('[MailerLite] Content endpoint failed (non-fatal, content already in POST):', {
        status: contentError?.response?.status,
        data: contentError?.response?.data,
      })
      // Non-fatal: content was already set via the initial POST
    }
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

      // Get sender and group settings from publication_settings (with fallback to app_settings)
      const emailSettings = await getEmailSettings(issue.publication_id)
      const senderName = emailSettings.sender_name
      const fromEmail = emailSettings.from_email
      const reviewGroupId = emailSettings.review_group_id
      const subjectEmoji = emailSettings.subject_line_emoji || '🧮'

      if (!reviewGroupId) {
        throw new Error('Review Group ID not configured in database settings')
      }

      console.log('Using publication settings:', { senderName, fromEmail, reviewGroupId })

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

        // Step 2: Push content with plain text and auto_inline
        const plainText = await this.generatePlainText(issue.publication_id, senderName)
        await this.pushCampaignContent(issueId, emailContent, plainText)

        // Step 3: Schedule the issue using the issue ID
        let scheduleData
        try {
          // Schedule review for TODAY at scheduled send time
          // issue is created at issue Creation Time (8:50pm) and scheduled to send same day at Scheduled Send Time
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          scheduleData = await this.getReviewScheduleData(today, issue.publication_id)
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
      const { data: metrics, error: metricsError } = await supabaseAdmin
        .from('email_metrics')
        .select('mailerlite_issue_id')
        .eq('issue_id', issueId)
        .maybeSingle()

      // Skip issues without email_metrics records
      if (metricsError || !metrics || !metrics.mailerlite_issue_id) {
        return { skipped: true, reason: 'No email_metrics record found' }
      }

      const mailerliteCampaignId = metrics.mailerlite_issue_id
      
      // Try multiple possible endpoints for campaign reports
      let response
      
      // Try endpoint 1: /campaigns/{id}/reports
      try {
        response = await mailerliteClient.get(`/campaigns/${mailerliteCampaignId}/reports`)
      } catch (error: any) {
        // Try endpoint 2: /campaigns/{id} (stats might be included in campaign data)
        try {
          const campaignResponse = await mailerliteClient.get(`/campaigns/${mailerliteCampaignId}`)
          if (campaignResponse.data?.data?.stats || campaignResponse.data?.data?.statistics) {
            response = campaignResponse
          } else {
            throw new Error('Stats not found in campaign response')
          }
        } catch (campaignError: any) {
          if (error?.response?.status === 404) {
            return { skipped: true, reason: 'Campaign not found in MailerLite (404)' }
          }
          throw error
        }
      }

      if (response.status === 200) {
        const data = response.data.data
        let stats = data

        if (data.stats) {
          stats = data.stats
        } else if (data.statistics) {
          stats = data.statistics
        }

        // Log the stats structure for debugging
        console.log(`[MailerLite] Stats for campaign ${mailerliteCampaignId}:`, {
          has_stats: !!data.stats,
          has_statistics: !!data.statistics,
          sent: stats.sent || 0,
          delivered: stats.delivered || stats.delivered_count || 0,
          opened_count: stats.opened?.count || stats.opens_count || stats.opened || 0,
          clicked_count: stats.clicked?.count || stats.clicks_count || stats.clicked || 0,
          open_rate: stats.opened?.rate || stats.open_rate || 0,
          click_rate: stats.clicked?.rate || stats.click_rate || 0
        })

        // Helper function to extract numeric value from rate fields
        // MailerLite returns rates as objects with { float: number, string: string }
        // or sometimes as direct numbers
        const extractRateValue = (value: any): number => {
          if (typeof value === 'number') return value
          if (value && typeof value === 'object' && 'float' in value) {
            return typeof value.float === 'number' ? value.float : 0
          }
          return 0
        }

        // Helper function to extract count values
        // MailerLite can return counts as nested objects (opened.count) or direct fields (opens_count)
        const extractCountValue = (nested: any, direct: any, directAlt?: any): number => {
          if (typeof nested === 'number') return nested
          if (typeof direct === 'number') return direct
          if (typeof directAlt === 'number') return directAlt
          if (nested && typeof nested === 'object' && 'count' in nested && typeof nested.count === 'number') {
            return nested.count
          }
          return 0
        }

        const metricsUpdate = {
          sent_count: stats.sent || 0,
          delivered_count: stats.delivered || stats.delivered_count || 0,
          opened_count: extractCountValue(stats.opened, stats.opens_count, stats.opened),
          clicked_count: extractCountValue(stats.clicked, stats.clicks_count, stats.clicked),
          bounced_count: extractCountValue(stats.bounced, stats.bounces_count, (stats.hard_bounces_count || 0) + (stats.soft_bounces_count || 0)),
          unsubscribed_count: extractCountValue(stats.unsubscribed, stats.unsubscribes_count),
          open_rate: extractRateValue(stats.opened?.rate || stats.open_rate),
          click_rate: extractRateValue(stats.clicked?.rate || stats.click_rate),
          bounce_rate: extractRateValue(stats.bounced?.rate || stats.bounce_rate || stats.hard_bounce_rate),
          unsubscribe_rate: extractRateValue(stats.unsubscribed?.rate || stats.unsubscribe_rate),
        }

        const { error: updateError } = await supabaseAdmin
          .from('email_metrics')
          .update(metricsUpdate)
          .eq('issue_id', issueId)

        if (updateError) {
          throw new Error(`Failed to update metrics: ${updateError.message}`)
        }

        console.log(`[MailerLite] Updated metrics for issue ${issueId}:`, metricsUpdate)

        return metricsUpdate
      }

      throw new Error(`Failed to fetch metrics from MailerLite: Status ${response.status}`)

    } catch (error) {
      // Re-throw skip indicators as-is
      if (error && typeof error === 'object' && 'skipped' in error) {
        throw error
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.logError('Failed to import issue metrics', {
        issueId,
        error: errorMessage
      })
      throw error
    }
  }


  private async generateEmailHTML(issue: issueWithEvents, isReview: boolean): Promise<string> {
    // Use the shared template function (single source of truth)
    // This ensures preview and actual send always match
    console.log(`[MailerLite] Generating email HTML using shared template (isReview: ${isReview})`)
    return generateFullNewsletterHtml(issue, { isReview })
  }


  private async getReviewScheduleData(date: string, publicationId: string): Promise<any> {
    try {
      // Get scheduled send time from publication_settings (with fallback to app_settings)
      const scheduleSettings = await getScheduleSettings(publicationId)
      const scheduledTime = scheduleSettings.review_send_time
      const timezoneId = scheduleSettings.timezone_id

      console.log('Using scheduled send time from publication settings:', scheduledTime)

      // Parse the time (format: "HH:MM")
      const [hours, minutes] = scheduledTime.split(':')

      // MailerLite scheduling format
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // YYYY-MM-DD format
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: timezoneId // Publication-specific timezone
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

  private async getFinalScheduleData(date: string, publicationId: string): Promise<any> {
    try {
      // Get final send time from publication_settings (with fallback to app_settings)
      const scheduleSettings = await getScheduleSettings(publicationId)
      const finalTime = scheduleSettings.final_send_time
      const timezoneId = scheduleSettings.timezone_id

      console.log('Using daily scheduled send time from publication settings:', finalTime)

      // Parse the time (format: "HH:MM")
      const [hours, minutes] = finalTime.split(':')

      // MailerLite scheduling format for final issue
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // Newsletter date (YYYY-MM-DD format)
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: timezoneId // Publication-specific timezone
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

  private async getSecondaryScheduleData(date: string, publicationId: string): Promise<any> {
    try {
      // Get secondary send time from publication_settings
      const secondaryTime = await getPublicationSetting(publicationId, 'email_secondaryScheduledSendTime')
      const timezoneIdStr = await getPublicationSetting(publicationId, 'email_timezone_id')
      const timezoneId = timezoneIdStr ? parseInt(timezoneIdStr, 10) : 157 // Default to Central Time

      const finalTime = secondaryTime || '04:55' // Default if not set

      console.log('Using secondary scheduled send time from publication settings:', finalTime)

      // Parse the time (format: "HH:MM")
      const [hours, minutes] = finalTime.split(':')

      // MailerLite scheduling format for secondary issue
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // Newsletter date (YYYY-MM-DD format)
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: timezoneId // Publication-specific timezone
        }
      }

      console.log('Secondary issue schedule data:', JSON.stringify(scheduleData, null, 2))
      return scheduleData

    } catch (error) {
      console.error('Error getting secondary schedule data, using default:', error)
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

  async createTestIssue(issue: issueWithEvents, testGroupId: string) {
    try {
      console.log(`[MailerLite] Creating test issue for ${issue.date}`)

      // Get sender settings and newsletter name from publication_settings
      const emailSettings = await getEmailSettings(issue.publication_id)
      const senderName = emailSettings.sender_name
      const fromEmail = emailSettings.from_email
      const subjectEmoji = emailSettings.subject_line_emoji || '🧮'

      const pubSettings = await getPublicationSettings(issue.publication_id, ['newsletter_name'])
      const newsletterName = pubSettings.newsletter_name || senderName

      const emailContent = await this.generateEmailHTML(issue, false)

      const subjectLine = issue.subject_line || `Newsletter - ${new Date(issue.date).toLocaleDateString()}`

      const issueData = {
        name: `[TEST] ${newsletterName} Newsletter: ${issue.date}`,
        type: 'regular',
        emails: [{
          subject: `${subjectEmoji} ${subjectLine}`,
          from_name: senderName,
          from: fromEmail,
          content: emailContent,
        }],
        groups: [testGroupId]
      }

      console.log('[MailerLite] Creating test campaign with data:', {
        name: issueData.name,
        subject: issueData.emails[0].subject,
        groupId: testGroupId
      })

      const response = await mailerliteClient.post('/campaigns', issueData)

      if (response.data && response.data.data && response.data.data.id) {
        const campaignId = response.data.data.id
        console.log('[MailerLite] Test campaign created:', campaignId)

        // Push content with plain text
        const plainText = await this.generatePlainText(issue.publication_id, senderName)
        await this.pushCampaignContent(campaignId, emailContent, plainText)

        // Schedule for now + 2 minutes
        const timezoneIdStr = await getPublicationSetting(issue.publication_id, 'email_timezone_id')
        const timezoneId = timezoneIdStr ? parseInt(timezoneIdStr, 10) : 157

        const nowCentral = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
        const centralDate = new Date(nowCentral)
        centralDate.setMinutes(centralDate.getMinutes() + 2)

        const date = centralDate.toISOString().split('T')[0]
        const hours = String(centralDate.getHours()).padStart(2, '0')
        const minutes = String(centralDate.getMinutes()).padStart(2, '0')

        const scheduleData = {
          delivery: 'scheduled',
          schedule: {
            date,
            hours,
            minutes,
            timezone_id: timezoneId
          }
        }

        console.log('[MailerLite] Scheduling test campaign:', scheduleData)

        try {
          const scheduleResponse = await mailerliteClient.post(`/campaigns/${campaignId}/schedule`, scheduleData)
          if (scheduleResponse.status === 200 || scheduleResponse.status === 201) {
            console.log('[MailerLite] Test campaign scheduled successfully')
          }
        } catch (scheduleError: any) {
          console.error('[MailerLite] Failed to schedule test campaign:', scheduleError?.response?.data || scheduleError)
        }

        return { success: true, campaignId }
      }

      throw new Error('Failed to create test campaign')

    } catch (error) {
      console.error('[MailerLite] Failed to create test issue:', error)
      throw error
    }
  }

  async createFinalissue(issue: issueWithEvents, mainGroupId: string, isSecondary: boolean = false) {
    try {
      console.log(`Creating ${isSecondary ? 'secondary' : 'final'} issue for ${issue.date}`)

      // Get newsletter slug for issue naming
      const { data: dbissue } = await supabaseAdmin
        .from('publication_issues')
        .select('newsletters(slug)')
        .eq('id', issue.id)
        .single()

      const newsletterSlug = (dbissue as any)?.newsletters?.slug || 'accounting'
      const newsletterName = newsletterSlug.charAt(0).toUpperCase() + newsletterSlug.slice(1)

      // Get sender settings from publication_settings (with fallback to app_settings)
      const emailSettings = await getEmailSettings(issue.publication_id)
      const senderName = emailSettings.sender_name
      const fromEmail = emailSettings.from_email
      const subjectEmoji = emailSettings.subject_line_emoji || '🧮'

      const emailContent = await this.generateEmailHTML(issue, false) // Not a review

      const subjectLine = issue.subject_line || `Newsletter - ${new Date(issue.date).toLocaleDateString()}`

      console.log(`Creating ${isSecondary ? 'secondary' : 'final'} issue with subject line:`, subjectLine)
      console.log('Using publication settings:', { senderName, fromEmail })

      const campaignName = isSecondary
        ? `${newsletterName} Newsletter (Secondary): ${issue.date}`
        : `${newsletterName} Newsletter: ${issue.date}`

      const issueData = {
        name: campaignName,
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

        // Push content with plain text and auto_inline
        const plainText = await this.generatePlainText(issue.publication_id, senderName)
        await this.pushCampaignContent(issueId, emailContent, plainText)

        // Schedule the final issue for TODAY at scheduled send time
        // issue is created at issue Creation Time and scheduled to send same day at Scheduled Send Time
        try {
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          const finalScheduleData = isSecondary
            ? await this.getSecondaryScheduleData(today, issue.publication_id)
            : await this.getFinalScheduleData(today, issue.publication_id)
          console.log(`Scheduling ${isSecondary ? 'secondary' : 'final'} issue for today with data:`, finalScheduleData)

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
            const finalScheduleData = await this.getFinalScheduleData(issue.date, issue.publication_id)
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

        // Store MailerLite issue ID in email_metrics table ONLY for primary final send (not secondary)
        if (!isSecondary) {
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

      // Update subscriber with custom field - MailerLite API accepts email as identifier
      const updateData = {
        fields: {
          [fieldName]: fieldValue
        }
      }

      const updateResponse = await mailerliteClient.put(`/subscribers/${encodeURIComponent(email)}`, updateData)

      if (updateResponse.status === 200 || updateResponse.status === 201) {
        console.log(`Successfully updated ${fieldName} for ${email}`)
        return { success: true }
      }

      console.error('Unexpected response status:', updateResponse.status)
      return { success: false, error: `Unexpected status: ${updateResponse.status}` }

    } catch (error: any) {
      // Check if it's a 404 (subscriber not found)
      if (error?.response?.status === 404) {
        console.log(`Subscriber ${email} not found in MailerLite`)
        return { success: false, error: 'Subscriber not found' }
      }
      console.error('Error updating MailerLite subscriber field:', error?.response?.data || error)
      return { success: false, error: error?.response?.data?.message || error }
    }
  }
}