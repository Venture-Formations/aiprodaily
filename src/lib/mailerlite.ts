import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { CampaignWithArticles, CampaignWithEvents, Article } from '@/types/database'
import { getWeatherForCampaign } from './weather-manager'
import {
  generateNewsletterHeader,
  generateNewsletterFooter,
  generateLocalScoopSection,
  generateLocalEventsSection,
  generateWordleSection,
  generateMinnesotaGetawaysSection,
  generateDiningDealsSection,
  generateRoadWorkSection,
  generatePollSection,
  generateCommunityBusinessSpotlightSection
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

      const emailContent = await this.generateEmailHTML(campaign, true)

      // Log subject line status
      console.log('Campaign subject line:', campaign.subject_line)
      console.log('Forced subject line parameter:', forcedSubjectLine)

      // Use forced subject line if provided, otherwise fall back to campaign subject line
      const subjectLine = forcedSubjectLine || campaign.subject_line || `Newsletter Review - ${new Date(campaign.date).toLocaleDateString()}`

      console.log('Final subject line being sent to MailerLite:', subjectLine)

      const campaignData = {
        name: `Review: ${campaign.date}`,
        type: 'regular',
        emails: [{
          subject: `🍦 ${subjectLine}`,
          from_name: 'St. Cloud Scoop',
          from: 'scoop@stcscoop.com',
          content: emailContent,
        }],
        groups: [process.env.MAILERLITE_REVIEW_GROUP_ID]
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
        try {
          // Schedule review for today (same day as creation), not campaign.date
          // Use Central Time for consistent date calculations
          const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
          const centralDate = new Date(nowCentral)
          const today = centralDate.toISOString().split('T')[0] // Today's date in YYYY-MM-DD
          const scheduleData = await this.getReviewScheduleData(today)
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
          // Don't fail the whole process if scheduling fails - campaign is still created
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
    console.log('MAILERLITE - Raw article data:', activeArticles.map(a => `ID: ${a.id}, Rank: ${a.rank}, Active: ${a.is_active}`).join(' | '))

    // Generate events using the same logic as preview
    const eventsHtml = await generateLocalEventsSection(campaign)

    console.log('MailerLite - Events HTML generated, length:', eventsHtml.length)

    // Fetch newsletter sections order
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    console.log('MailerLite - Active newsletter sections:', sections?.map(s => `${s.name} (order: ${s.display_order})`).join(', '))

    // Use the same format as the preview template with local date parsing
    const [year, month, day] = campaign.date.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Review header for review campaigns - now at very top
    const reviewHeaderTop = isReview ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin: 10px auto; max-width: 990px; background-color: #FEF3C7; font-family: Arial, sans-serif;">
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

    // Generate sections in order based on database configuration
    let sectionsHtml = ''
    if (sections && sections.length > 0) {
      for (const section of sections) {
        if (section.name === 'The Local Scoop' && activeArticles.length > 0) {
          // Note: mailerlite_campaign_id is undefined during preview, only available after sending
          sectionsHtml += generateLocalScoopSection(activeArticles, campaign.date, undefined)
        } else if (section.name === 'Local Events') {
          sectionsHtml += eventsHtml
          // Add poll section after Local Events
          sectionsHtml += await generatePollSection(campaign.id)
        } else if (section.name === 'Local Weather') {
          const weatherHtml = await getWeatherForCampaign(campaign.id)
          if (weatherHtml) {
            sectionsHtml += weatherHtml
          }
        } else if (section.name === "Yesterday's Wordle") {
          const wordleHtml = await generateWordleSection(campaign)
          if (wordleHtml) {
            sectionsHtml += wordleHtml
          }
        } else if (section.name === 'Minnesota Getaways') {
          const getawaysHtml = await generateMinnesotaGetawaysSection(campaign)
          if (getawaysHtml) {
            sectionsHtml += getawaysHtml
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
        } else if (section.name === 'Community Business Spotlight') {
          const spotlightHtml = await generateCommunityBusinessSpotlightSection(campaign, !isReview) // Record usage for final campaigns only
          if (spotlightHtml) {
            sectionsHtml += spotlightHtml
          }
        }
      }
    } else {
      // Fallback to default order if no sections configured
      console.log('MailerLite - No sections found, using default order')
      sectionsHtml = generateLocalScoopSection(activeArticles, campaign.date, undefined) + eventsHtml
    }

    // Use exact same template as preview with review banner at top and global email rules
    return `<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #f7f7f7;
      font-family: Arial, sans-serif;
      color: #000;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    .row-content {
      max-width: 600px;
      margin: 0 auto;
      background-color: #e0f0ff;
    }
    .stack .column {
      display: inline-block;
      vertical-align: top;
    }
    .mobile_hide {
      display: block;
    }
    .desktop_hide {
      display: none;
      max-height: 0;
      overflow: hidden;
    }
    @media (max-width: 620px) {
      .row-content {
        width: 100% !important;
      }
      .stack .column {
        width: 100% !important;
        display: block !important;
      }
      .mobile_hide {
        display: none !important;
      }
      .desktop_hide {
        display: table !important;
        max-height: none !important;
      }
    }
    @media only screen and (max-width: 620px) {
      body, table, td, div {
        padding-left: 5px !important;
        padding-right: 5px !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      .row {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .column {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 4px !important;
        padding-right: 4px !important;
        box-sizing: border-box !important;
      }
    }
    @media only screen and (min-width: 621px) {
      .row {
        display: table !important;
        width: 100% !important;
        table-layout: fixed !important;
      }
      .column {
        display: table-cell !important;
        width: 33.33% !important;
        vertical-align: top;
        box-sizing: border-box !important;
        padding: 8px !important;
      }
    }
    @media only screen and (max-width: 620px) {
      .event-card {
        width: 100% !important;
        max-width: 100% !important;
      }
    }
    @media only screen and (max-width:620px){
      .weather-desktop{display:none!important;max-height:0!important;overflow:hidden!important;}
      .weather-mobile{display:table!important;max-height:none!important;width:100%!important;}
      .weather-mobile .wxcol{display:block!important;width:100%!important;max-width:100%!important;padding:4px 0!important;}
      .weather-mobile .weather-card{width:100%!important;max-width:100%!important;margin:0 auto!important;}
    }
    @media only screen and (min-width:621px){
      .weather-mobile{display:none!important;max-height:0!important;overflow:hidden!important;}
    }
    @media only screen and (min-width:621px){
      .etsy-wrap{font-size:0 !important;}
      .etsy-col{display:inline-block !important; width:25% !important; max-width:25% !important; vertical-align:top !important;}
      .etsy-pad{padding:8px !important;}
    }
  </style>
  <title>St. Cloud Scoop Newsletter</title>
</head>
<body style='margin:0!important;padding:0!important;background-color:#f7f7f7;'>
${reviewHeaderTop}
   <div style='width:100%;margin:0 auto;padding:10px;background-color:#f7f7f7;box-sizing:border-box;overflow-x:auto;'>
     <div style='width:100%;max-width:990px;margin:0 auto;padding:5px;text-align:right;font-weight:bold;'>
       <a href='{$url}' style='color:#000;text-decoration:underline;'>View Online</a>&nbsp;|&nbsp;
       <a href='https://stcscoop.com/' style='color:#000;text-decoration:underline;'>Sign Up</a>&nbsp;|&nbsp;
       <a href='{$forward}' style='color:#000;text-decoration:underline;'>Share</a>
     </div>
     <div style='width:100%;max-width:990px;margin:0 auto;padding:0px;'>
       <div style='font-family:Arial,sans-serif;background-color:#1877F2;text-align:center;border-radius:12px;border:1px solid #333;'>
         <img alt='St. Cloud Scoop' src='https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png' style='width:100%;max-width:500px;height:auto;margin-bottom:2px;'/>
         <div style='color:#fff;font-size:16px;font-weight:bold;padding:0 0 5px;'>${formattedDate}</div>
       </div>
     </div>
   </div>
<br>
${sectionsHtml}
<div style="max-width: 990px; margin: 0 auto; background-color: #1877F2; padding: 8px 0; text-align: center;">
  <a href="https://www.facebook.com/61578947310955/" target="_blank">
    <img src="https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: inline-block;">
  </a>
</div>
<div style="font-family: Arial, sans-serif; font-size: 12px; color: #777; text-align: center; padding: 20px 10px; border-top: 1px solid #ccc; background-color: #ffffff; max-width: 990px; margin: 0 auto ;">
  <p style="margin: 0;text-align: center;">You're receiving this email because you subscribed to <strong>St. Cloud Scoop</strong>.</p>
  <p style="margin: 5px 0 0;text-align: center;">
    <a href="{$unsubscribe}" style='text-decoration: underline;'>Unsubscribe</a>
  </p>
  <p style="margin: 5px;text-align: center;">©2025 Venture Formations LLC, all rights reserved</p>
</div>
</body>
</html>`
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

      // Get sender settings
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['email_senderName', 'email_fromEmail'])

      const settingsMap = (settings || []).reduce((acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      }, {} as Record<string, string>)

      const senderName = settingsMap['email_senderName'] || 'St. Cloud Scoop'
      const fromEmail = settingsMap['email_fromEmail'] || 'scoop@stcscoop.com'

      const emailContent = await this.generateEmailHTML(campaign, false) // Not a review

      const subjectLine = campaign.subject_line || `Newsletter - ${new Date(campaign.date).toLocaleDateString()}`

      console.log('Creating final campaign with subject line:', subjectLine)
      console.log('Using sender settings:', { senderName, fromEmail })

      const campaignData = {
        name: `Newsletter: ${campaign.date}`,
        type: 'regular',
        emails: [{
          subject: `🍦 ${subjectLine}`,
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

        // Schedule the final campaign for the newsletter date
        try {
          const finalScheduleData = await this.getFinalScheduleData(campaign.date)
          console.log('Scheduling final campaign for newsletter date with data:', finalScheduleData)

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
          // Don't fail the whole process if scheduling fails - campaign is still created
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
        <p>St. Cloud Scoop | <a href="https://st-cloud-scoop.vercel.app">st-cloud-scoop.vercel.app</a></p>
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
        <p>St. Cloud Scoop | <a href="https://st-cloud-scoop.vercel.app">st-cloud-scoop.vercel.app</a></p>
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