import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { CampaignWithArticles, CampaignWithEvents, Article } from '@/types/database'
import {
  generateNewsletterHeader,
  generateNewsletterFooter,
  generateWelcomeSection,
  generateDiningDealsSection,
  generateRoadWorkSection,
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

  async createReviewCampaign(campaign: CampaignWithEvents, forcedSubjectLine?: string) {
    try {
      console.log(`Creating review campaign for ${campaign.date}`)

      // Get newsletter slug for campaign naming
      const { data: dbCampaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('newsletters(slug)')
        .eq('id', campaign.id)
        .single()

      const newsletterSlug = (dbCampaign as any)?.newsletters?.slug || 'accounting'
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

      const emailContent = await this.generateEmailHTML(campaign, true)

      // Log subject line status
      console.log('Campaign subject line:', campaign.subject_line)
      console.log('Forced subject line parameter:', forcedSubjectLine)

      // Use forced subject line if provided, otherwise fall back to campaign subject line
      const subjectLine = forcedSubjectLine || campaign.subject_line || `Newsletter Review - ${new Date(campaign.date).toLocaleDateString()}`

      console.log('Final subject line being sent to MailerLite:', subjectLine)

      const campaignData = {
        name: `${newsletterName} Review: ${campaign.date}`,
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

      console.log('Sending MailerLite API request with data:', JSON.stringify(campaignData, null, 2))

      const response = await mailerliteClient.post('/campaigns', campaignData)

      console.log('MailerLite API response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      })

      if (response.status === 201) {
        const campaignId = response.data.data.id
        console.log('Campaign created successfully with ID:', campaignId)

        // Step 2: Schedule the campaign using the campaign ID
        let scheduleData
        try {
          // Schedule review for TODAY at scheduled send time
          // Campaign is created at Campaign Creation Time (8:50pm) and scheduled to send same day at Scheduled Send Time
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          scheduleData = await this.getReviewScheduleData(today)
          console.log('Scheduling review campaign for today with data:', scheduleData)

          const scheduleResponse = await mailerliteClient.post(`/campaigns/${campaignId}/schedule`, scheduleData)

          console.log('MailerLite schedule response:', {
            status: scheduleResponse.status,
            statusText: scheduleResponse.statusText,
            data: scheduleResponse.data
          })

          if (scheduleResponse.status === 200 || scheduleResponse.status === 201) {
            console.log('Campaign scheduled successfully')
          } else {
            console.error('Failed to schedule campaign:', scheduleResponse.status, scheduleResponse.data)
          }
        } catch (scheduleError) {
          console.error('Error scheduling campaign:', scheduleError)

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
            await this.logError('Failed to schedule review campaign', {
              campaignId: campaign.id,
              mailerliteCampaignId: campaignId,
              scheduleData,
              errorStatus: axiosError.response?.status,
              errorData: axiosError.response?.data
            })
          }

          // Don't fail the whole process if scheduling fails - campaign is still created
        }

        // Store MailerLite campaign ID in email_metrics table
        // Check if metrics record exists first
        const { data: existingMetrics } = await supabaseAdmin
          .from('email_metrics')
          .select('id')
          .eq('campaign_id', campaign.id)
          .single()

        if (existingMetrics) {
          // Update existing record
          const { error: updateError } = await supabaseAdmin
            .from('email_metrics')
            .update({ mailerlite_campaign_id: campaignId })
            .eq('id', existingMetrics.id)

          if (updateError) {
            console.error('Failed to update MailerLite campaign ID:', updateError)
          } else {
            console.log(`Updated MailerLite campaign ID ${campaignId} in email_metrics`)
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabaseAdmin
            .from('email_metrics')
            .insert({
              campaign_id: campaign.id,
              mailerlite_campaign_id: campaignId
            })

          if (insertError) {
            console.error('Failed to insert MailerLite campaign ID:', insertError)
          } else {
            console.log(`Stored MailerLite campaign ID ${campaignId} in email_metrics`)
          }
        }

        // Update campaign with review sent timestamp
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({
            status: 'in_review',
            review_sent_at: new Date().toISOString()
          })
          .eq('id', campaign.id)

        await this.errorHandler.logInfo('Review campaign created successfully', {
          campaignId: campaign.id,
          mailerliteCampaignId: campaignId
        }, 'mailerlite_service')

        await this.slack.sendEmailCampaignAlert('review', true, campaign.id)

        return { success: true, campaignId }
      }

      throw new Error('Failed to create review campaign')

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
        operation: 'createReviewCampaign',
        campaignId: campaign.id,
        errorDetails
      })
      await this.slack.sendEmailCampaignAlert('review', false, campaign.id, errorMessage)
      throw new Error(errorMessage)
    }
  }


  async importCampaignMetrics(campaignId: string) {
    try {
      const { data: metrics } = await supabaseAdmin
        .from('email_metrics')
        .select('mailerlite_campaign_id')
        .eq('campaign_id', campaignId)
        .single()

      if (!metrics?.mailerlite_campaign_id) {
        throw new Error('MailerLite campaign ID not found')
      }

      const response = await mailerliteClient.get(`/campaigns/${metrics.mailerlite_campaign_id}/reports`)

      if (response.status === 200) {
        const data = response.data.data

        const metricsUpdate = {
          sent_count: data.sent || 0,
          delivered_count: data.delivered || 0,
          opened_count: data.opened?.count || 0,
          clicked_count: data.clicked?.count || 0,
          bounced_count: data.bounced?.count || 0,
          unsubscribed_count: data.unsubscribed?.count || 0,
          open_rate: data.opened?.rate || 0,
          click_rate: data.clicked?.rate || 0,
          bounce_rate: data.bounced?.rate || 0,
          unsubscribe_rate: data.unsubscribed?.rate || 0,
        }

        await supabaseAdmin
          .from('email_metrics')
          .update(metricsUpdate)
          .eq('campaign_id', campaignId)

        return metricsUpdate
      }

      throw new Error('Failed to fetch metrics from MailerLite')

    } catch (error) {
      await this.logError('Failed to import campaign metrics', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }


  private async generateEmailHTML(campaign: CampaignWithEvents, isReview: boolean): Promise<string> {
    // Filter active articles and sort by rank (custom order)
    const activeArticles = campaign.articles
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
    const [year, month, day] = campaign.date.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Use the modular template functions with tracking - SAME AS PREVIEW
    // mailerlite_campaign_id might not exist yet during review, so it's optional
    const mailerliteId = (campaign as any).mailerlite_campaign_id || undefined
    const header = await generateNewsletterHeader(formattedDate, campaign.date, mailerliteId)
    const footer = await generateNewsletterFooter(campaign.date, mailerliteId)

    // Generate welcome section (if it exists)
    const welcomeHtml = await generateWelcomeSection(
      campaign.welcome_intro || null,
      campaign.welcome_tagline || null,
      campaign.welcome_summary || null
    )

    // Review banner for review campaigns
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
      PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b'
    }

    // Generate sections in order based on database configuration - SAME AS PREVIEW
    let sectionsHtml = ''
    if (sections && sections.length > 0) {
      for (const section of sections) {
        // Check if this is a primary articles section (display_order 3)
        if (section.display_order === 3 && activeArticles.length > 0) {
          const { generatePrimaryArticlesSection } = await import('./newsletter-templates')
          const primaryHtml = await generatePrimaryArticlesSection(activeArticles, campaign.date, campaign.id, section.name)
          sectionsHtml += primaryHtml
        }
        // Check if this is a secondary articles section (display_order 5)
        else if (section.display_order === 5) {
          const { generateSecondaryArticlesSection } = await import('./newsletter-templates')
          const secondaryHtml = await generateSecondaryArticlesSection(campaign, section.name)
          sectionsHtml += secondaryHtml
        }
        // Use section ID for AI Applications (stable across name changes)
        else if (section.id === SECTION_IDS.AI_APPLICATIONS) {
          const { generateAIAppsSection } = await import('./newsletter-templates')
          const aiAppsHtml = await generateAIAppsSection(campaign)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        // Use section ID for Prompt Ideas (stable across name changes)
        else if (section.id === SECTION_IDS.PROMPT_IDEAS) {
          const { generatePromptIdeasSection } = await import('./newsletter-templates')
          const promptHtml = await generatePromptIdeasSection(campaign)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        // Legacy name-based matching for other sections
        else if (section.name === 'Poll') {
          const pollHtml = await generatePollSection(campaign.id)
          if (pollHtml) {
            sectionsHtml += pollHtml
          }
        } else if (section.name === 'Dining Deals') {
          const diningHtml = await generateDiningDealsSection(campaign)
          if (diningHtml) {
            sectionsHtml += diningHtml
          }
        } else if (section.name === 'Road Work') {
          const roadWorkHtml = await generateRoadWorkSection(campaign)
          if (roadWorkHtml) {
            sectionsHtml += roadWorkHtml
          }
        } else if (section.name === 'Breaking News') {
          const { generateBreakingNewsSection } = await import('./newsletter-templates')
          const breakingNewsHtml = await generateBreakingNewsSection(campaign)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        } else if (section.name === 'Beyond the Feed') {
          const { generateBeyondTheFeedSection } = await import('./newsletter-templates')
          const beyondFeedHtml = await generateBeyondTheFeedSection(campaign)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        } else if (section.name === 'Advertorial') {
          const advertorialHtml = await generateAdvertorialSection(campaign, !isReview) // Record usage for final campaigns only
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

      // MailerLite scheduling format for final campaign
      const scheduleData = {
        delivery: 'scheduled',
        schedule: {
          date: date, // Newsletter date (YYYY-MM-DD format)
          hours: hours, // HH format
          minutes: minutes, // MM format
          timezone_id: 157 // Central Time zone ID
        }
      }

      console.log('Final campaign schedule data:', JSON.stringify(scheduleData, null, 2))
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

  async createFinalCampaign(campaign: CampaignWithEvents, mainGroupId: string) {
    try {
      console.log(`Creating final campaign for ${campaign.date}`)

      // Get newsletter slug for campaign naming
      const { data: dbCampaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('newsletters(slug)')
        .eq('id', campaign.id)
        .single()

      const newsletterSlug = (dbCampaign as any)?.newsletters?.slug || 'accounting'
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

      const emailContent = await this.generateEmailHTML(campaign, false) // Not a review

      const subjectLine = campaign.subject_line || `Newsletter - ${new Date(campaign.date).toLocaleDateString()}`

      console.log('Creating final campaign with subject line:', subjectLine)
      console.log('Using sender settings:', { senderName, fromEmail })

      const campaignData = {
        name: `${newsletterName} Newsletter: ${campaign.date}`,
        type: 'regular',
        emails: [{
          subject: `${subjectEmoji} ${subjectLine}`,
          from_name: senderName,
          from: fromEmail,
          content: emailContent,
        }],
        groups: [mainGroupId]
      }

      console.log('Creating MailerLite campaign with data:', {
        name: campaignData.name,
        subject: campaignData.emails[0].subject,
        groupId: mainGroupId
      })

      const response = await mailerliteClient.post('/campaigns', campaignData)

      if (response.data && response.data.data && response.data.data.id) {
        const campaignId = response.data.data.id

        console.log('Final campaign created successfully:', campaignId)

        // Schedule the final campaign for TODAY at scheduled send time
        // Campaign is created at Campaign Creation Time and scheduled to send same day at Scheduled Send Time
        try {
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          const finalScheduleData = await this.getFinalScheduleData(today)
          console.log('Scheduling final campaign for today with data:', finalScheduleData)

          const scheduleResponse = await mailerliteClient.post(`/campaigns/${campaignId}/schedule`, finalScheduleData)

          console.log('Final campaign schedule response:', {
            status: scheduleResponse.status,
            statusText: scheduleResponse.statusText,
            data: scheduleResponse.data
          })

          if (scheduleResponse.status === 200 || scheduleResponse.status === 201) {
            console.log('Final campaign scheduled successfully')
          } else {
            console.error('Failed to schedule final campaign:', scheduleResponse.status, scheduleResponse.data)
          }
        } catch (scheduleError) {
          console.error('Error scheduling final campaign:', scheduleError)

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
            const finalScheduleData = await this.getFinalScheduleData(campaign.date)
            await this.logError('Failed to schedule final campaign', {
              campaignId: campaign.id,
              mailerliteCampaignId: campaignId,
              scheduleData: finalScheduleData,
              errorStatus: axiosError.response?.status,
              errorData: axiosError.response?.data
            })
          }

          // Don't fail the whole process if scheduling fails - campaign is still created
        }

        // Store MailerLite campaign ID in email_metrics table
        // Check if metrics record exists first
        const { data: existingMetrics } = await supabaseAdmin
          .from('email_metrics')
          .select('id')
          .eq('campaign_id', campaign.id)
          .single()

        if (existingMetrics) {
          // Update existing record
          const { error: updateError } = await supabaseAdmin
            .from('email_metrics')
            .update({ mailerlite_campaign_id: campaignId })
            .eq('id', existingMetrics.id)

          if (updateError) {
            console.error('Failed to update MailerLite campaign ID:', updateError)
          } else {
            console.log(`Updated MailerLite campaign ID ${campaignId} in email_metrics`)
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabaseAdmin
            .from('email_metrics')
            .insert({
              campaign_id: campaign.id,
              mailerlite_campaign_id: campaignId
            })

          if (insertError) {
            console.error('Failed to insert MailerLite campaign ID:', insertError)
          } else {
            console.log(`Stored MailerLite campaign ID ${campaignId} in email_metrics`)
          }
        }

        await this.logInfo('Final campaign created successfully', {
          campaignId: campaign.id,
          mailerliteCampaignId: campaignId,
          mainGroupId: mainGroupId
        })

        await this.slack.sendEmailCampaignAlert('final', true, campaign.id)

        return { success: true, campaignId }
      }

      throw new Error('Failed to create final campaign')

    } catch (error) {
      console.error('Failed to create final campaign:', error)

      if (error instanceof Error) {
        await this.logError('Failed to create final campaign', {
          error: error.message,
          campaignId: campaign.id,
          mainGroupId: mainGroupId
        })

        await this.slack.sendEmailCampaignAlert('final', false, campaign.id, error.message)
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