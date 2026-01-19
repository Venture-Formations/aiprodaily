/**
 * SendGrid Email Service
 *
 * Handles all SendGrid operations for the newsletter system:
 * - Campaign creation (Single Sends)
 * - Campaign scheduling
 * - Contact/subscriber management
 * - Metrics import
 * - Transactional emails
 *
 * @see docs/migrations/SENDGRID_MIGRATION_PLAN.md
 */

import sgMail from '@sendgrid/mail'
import sgClient from '@sendgrid/client'
import { supabaseAdmin } from './supabase'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { IssueWithEvents, Article } from '@/types/database'
import {
  generateNewsletterHeader,
  generateNewsletterFooter,
  generateWelcomeSection
} from './newsletter-templates'
import { getEmailSettings, getScheduleSettings, getPublicationSetting, getPublicationSettings } from './publication-settings'

// Initialize SendGrid clients
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || ''
sgMail.setApiKey(SENDGRID_API_KEY)
sgClient.setApiKey(SENDGRID_API_KEY)

// Timezone offset mapping (Central Time = -06:00 in winter, -05:00 in summer)
// We use the account timezone setting in SendGrid, so we calculate UTC offset
function getCentralTimeOffset(): string {
  // Check if we're in daylight saving time
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1)
  const jul = new Date(now.getFullYear(), 6, 1)
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  const isDST = now.getTimezoneOffset() < stdOffset
  return isDST ? '-05:00' : '-06:00'
}

/**
 * Convert date and time to ISO 8601 format for SendGrid scheduling
 */
function toSendGridSchedule(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM
  const offset = getCentralTimeOffset()
  return `${date}T${time}:00${offset}`
}

export interface SendGridSettings {
  sender_id: number
  main_list_id: string
  review_list_id: string
  unsubscribe_group_id: number
  sender_name: string
  from_email: string
  subject_line_emoji: string
}

export interface MetricsResult {
  sent_count?: number
  delivered_count?: number
  opened_count?: number
  clicked_count?: number
  bounced_count?: number
  unsubscribed_count?: number
  open_rate?: number
  click_rate?: number
  bounce_rate?: number
  unsubscribe_rate?: number
  skipped?: boolean
  reason?: string
}

export class SendGridService {
  private errorHandler: ErrorHandler
  private slack: SlackNotificationService

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.slack = new SlackNotificationService()
  }

  /**
   * Get SendGrid-specific settings for a publication
   */
  async getSendGridSettings(publicationId: string): Promise<SendGridSettings> {
    const settings = await getPublicationSettings(publicationId, [
      'sendgrid_sender_id',
      'sendgrid_main_list_id',
      'sendgrid_review_list_id',
      'sendgrid_unsubscribe_group_id',
      'email_senderName',
      'email_fromEmail',
      'subject_line_emoji',
    ])

    // Also get email settings for sender info (fallback)
    const emailSettings = await getEmailSettings(publicationId)

    return {
      sender_id: parseInt(settings.sendgrid_sender_id || '0', 10),
      main_list_id: settings.sendgrid_main_list_id || '',
      review_list_id: settings.sendgrid_review_list_id || '',
      unsubscribe_group_id: parseInt(settings.sendgrid_unsubscribe_group_id || '0', 10),
      sender_name: settings.email_senderName || emailSettings.sender_name,
      from_email: settings.email_fromEmail || emailSettings.from_email,
      subject_line_emoji: settings.subject_line_emoji || emailSettings.subject_line_emoji || '',
    }
  }

  /**
   * Create and schedule a review campaign (Single Send)
   */
  async createReviewCampaign(issue: IssueWithEvents, forcedSubjectLine?: string): Promise<{ success: boolean; campaignId?: string; error?: string }> {
    try {
      console.log(`[SendGrid] Creating review campaign for ${issue.date}`)

      // Get newsletter slug for campaign naming
      const { data: dbIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('newsletters(slug)')
        .eq('id', issue.id)
        .single()

      const newsletterSlug = (dbIssue as any)?.newsletters?.slug || 'newsletter'
      const newsletterName = newsletterSlug.charAt(0).toUpperCase() + newsletterSlug.slice(1)

      // Get SendGrid settings
      const sgSettings = await this.getSendGridSettings(issue.publication_id)

      if (!sgSettings.review_list_id) {
        throw new Error('SendGrid review list ID not configured')
      }

      // Generate email HTML content
      const emailContent = await this.generateEmailHTML(issue, true)

      // Build subject line
      const subjectLine = forcedSubjectLine || issue.subject_line || `Newsletter Review - ${new Date(issue.date).toLocaleDateString()}`
      const fullSubject = sgSettings.subject_line_emoji
        ? `${sgSettings.subject_line_emoji} ${subjectLine}`
        : subjectLine

      console.log('[SendGrid] Creating Single Send with subject:', fullSubject)

      // Create Single Send via API
      const singleSendData = {
        name: `${newsletterName} Review: ${issue.date}`,
        send_to: {
          list_ids: [sgSettings.review_list_id]
        },
        email_config: {
          subject: fullSubject,
          sender_id: sgSettings.sender_id,
          html_content: emailContent,
          suppression_group_id: sgSettings.unsubscribe_group_id,
          custom_unsubscribe_url: '',
          editor: 'code' as const
        }
      }

      const [createResponse, createBody] = await sgClient.request({
        method: 'POST',
        url: '/v3/marketing/singlesends',
        body: singleSendData
      })

      console.log('[SendGrid] Create Single Send response:', {
        status: createResponse.statusCode,
        body: createBody
      })

      if (createResponse.statusCode !== 200 && createResponse.statusCode !== 201) {
        throw new Error(`Failed to create Single Send: ${JSON.stringify(createBody)}`)
      }

      const campaignId = (createBody as any).id
      console.log('[SendGrid] Single Send created with ID:', campaignId)

      // Schedule the campaign for today at review send time
      try {
        const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
        const centralDate = new Date(nowCentral)
        const today = centralDate.toISOString().split('T')[0]

        const scheduleSettings = await getScheduleSettings(issue.publication_id)
        const sendAt = toSendGridSchedule(today, scheduleSettings.review_send_time)

        console.log('[SendGrid] Scheduling review for:', sendAt)

        const [scheduleResponse] = await sgClient.request({
          method: 'PUT',
          url: `/v3/marketing/singlesends/${campaignId}/schedule`,
          body: { send_at: sendAt }
        })

        console.log('[SendGrid] Schedule response status:', scheduleResponse.statusCode)

      } catch (scheduleError) {
        console.error('[SendGrid] Error scheduling review campaign:', scheduleError)
        await this.logError('Failed to schedule review campaign', {
          issueId: issue.id,
          campaignId,
          error: scheduleError instanceof Error ? scheduleError.message : 'Unknown error'
        })
        // Don't fail - campaign was created, just not scheduled
      }

      // Update issue status
      await supabaseAdmin
        .from('publication_issues')
        .update({
          status: 'in_review',
          review_sent_at: new Date().toISOString()
        })
        .eq('id', issue.id)

      await this.logInfo('Review campaign created successfully', {
        issueId: issue.id,
        sendgridCampaignId: campaignId
      })

      await this.slack.sendEmailIssueAlert('review', true, issue.id)

      return { success: true, campaignId }

    } catch (error) {
      console.error('[SendGrid] Error creating review campaign:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.errorHandler.handleError(error, {
        source: 'sendgrid_service',
        operation: 'createReviewCampaign',
        issueId: issue.id
      })
      await this.slack.sendEmailIssueAlert('review', false, issue.id, errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Create and schedule a final campaign (Single Send)
   */
  async createFinalCampaign(issue: IssueWithEvents, isSecondary: boolean = false): Promise<{ success: boolean; campaignId?: string; error?: string }> {
    try {
      console.log(`[SendGrid] Creating ${isSecondary ? 'secondary' : 'final'} campaign for ${issue.date}`)

      // Get newsletter slug for campaign naming
      const { data: dbIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('newsletters(slug)')
        .eq('id', issue.id)
        .single()

      const newsletterSlug = (dbIssue as any)?.newsletters?.slug || 'newsletter'
      const newsletterName = newsletterSlug.charAt(0).toUpperCase() + newsletterSlug.slice(1)

      // Get SendGrid settings
      const sgSettings = await this.getSendGridSettings(issue.publication_id)

      if (!sgSettings.main_list_id) {
        throw new Error('SendGrid main list ID not configured')
      }

      // Generate email HTML content (not a review)
      const emailContent = await this.generateEmailHTML(issue, false)

      // Build subject line
      const subjectLine = issue.subject_line || `Newsletter - ${new Date(issue.date).toLocaleDateString()}`
      const fullSubject = sgSettings.subject_line_emoji
        ? `${sgSettings.subject_line_emoji} ${subjectLine}`
        : subjectLine

      const campaignName = isSecondary
        ? `${newsletterName} Newsletter (Secondary): ${issue.date}`
        : `${newsletterName} Newsletter: ${issue.date}`

      console.log('[SendGrid] Creating final Single Send:', campaignName)

      // Create Single Send via API
      const singleSendData = {
        name: campaignName,
        send_to: {
          list_ids: [sgSettings.main_list_id]
        },
        email_config: {
          subject: fullSubject,
          sender_id: sgSettings.sender_id,
          html_content: emailContent,
          suppression_group_id: sgSettings.unsubscribe_group_id,
          custom_unsubscribe_url: '',
          editor: 'code' as const
        }
      }

      const [createResponse, createBody] = await sgClient.request({
        method: 'POST',
        url: '/v3/marketing/singlesends',
        body: singleSendData
      })

      console.log('[SendGrid] Create final Single Send response:', {
        status: createResponse.statusCode
      })

      if (createResponse.statusCode !== 200 && createResponse.statusCode !== 201) {
        throw new Error(`Failed to create Single Send: ${JSON.stringify(createBody)}`)
      }

      const campaignId = (createBody as any).id
      console.log('[SendGrid] Final Single Send created with ID:', campaignId)

      // Schedule the campaign
      try {
        const nowCentral = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
        const centralDate = new Date(nowCentral)
        const today = centralDate.toISOString().split('T')[0]

        let sendTime: string
        if (isSecondary) {
          const secondaryTime = await getPublicationSetting(issue.publication_id, 'email_secondaryScheduledSendTime')
          sendTime = secondaryTime || '04:55'
        } else {
          const scheduleSettings = await getScheduleSettings(issue.publication_id)
          sendTime = scheduleSettings.final_send_time
        }

        const sendAt = toSendGridSchedule(today, sendTime)
        console.log(`[SendGrid] Scheduling ${isSecondary ? 'secondary' : 'final'} for:`, sendAt)

        const [scheduleResponse] = await sgClient.request({
          method: 'PUT',
          url: `/v3/marketing/singlesends/${campaignId}/schedule`,
          body: { send_at: sendAt }
        })

        console.log('[SendGrid] Schedule response status:', scheduleResponse.statusCode)

      } catch (scheduleError) {
        console.error('[SendGrid] Error scheduling final campaign:', scheduleError)
        await this.logError('Failed to schedule final campaign', {
          issueId: issue.id,
          campaignId,
          isSecondary,
          error: scheduleError instanceof Error ? scheduleError.message : 'Unknown error'
        })
      }

      // Store SendGrid campaign ID in email_metrics (only for primary final send)
      if (!isSecondary) {
        const { data: existingMetrics } = await supabaseAdmin
          .from('email_metrics')
          .select('id')
          .eq('issue_id', issue.id)
          .single()

        if (existingMetrics) {
          await supabaseAdmin
            .from('email_metrics')
            .update({ sendgrid_singlesend_id: campaignId })
            .eq('id', existingMetrics.id)
        } else {
          await supabaseAdmin
            .from('email_metrics')
            .insert({
              issue_id: issue.id,
              sendgrid_singlesend_id: campaignId
            })
        }
        console.log(`[SendGrid] Stored campaign ID ${campaignId} in email_metrics`)
      }

      await this.logInfo('Final campaign created successfully', {
        issueId: issue.id,
        sendgridCampaignId: campaignId,
        isSecondary
      })

      await this.slack.sendEmailIssueAlert('final', true, issue.id)

      return { success: true, campaignId }

    } catch (error) {
      console.error('[SendGrid] Error creating final campaign:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.errorHandler.handleError(error, {
        source: 'sendgrid_service',
        operation: 'createFinalCampaign',
        issueId: issue.id
      })
      await this.slack.sendEmailIssueAlert('final', false, issue.id, errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Import campaign metrics from SendGrid
   */
  async importCampaignMetrics(issueId: string, singlesendId: string): Promise<MetricsResult> {
    try {
      console.log(`[SendGrid] Importing metrics for campaign ${singlesendId}`)

      const [response, body] = await sgClient.request({
        method: 'GET',
        url: `/v3/marketing/stats/singlesends/${singlesendId}`
      })

      if (response.statusCode !== 200) {
        console.error('[SendGrid] Failed to fetch metrics:', response.statusCode, body)
        return { skipped: true, reason: `API error: ${response.statusCode}` }
      }

      const results = (body as any).results
      if (!results || results.length === 0) {
        return { skipped: true, reason: 'No stats available yet' }
      }

      const stats = results[0].stats

      // Calculate rates
      const delivered = stats.delivered || 0
      const openRate = delivered > 0 ? (stats.unique_opens || 0) / delivered : 0
      const clickRate = delivered > 0 ? (stats.unique_clicks || 0) / delivered : 0
      const bounceRate = delivered > 0 ? (stats.bounces || 0) / delivered : 0
      const unsubscribeRate = delivered > 0 ? (stats.unsubscribes || 0) / delivered : 0

      const metricsUpdate: MetricsResult = {
        sent_count: stats.requests || 0,
        delivered_count: delivered,
        opened_count: stats.unique_opens || 0,
        clicked_count: stats.unique_clicks || 0,
        bounced_count: stats.bounces || 0,
        unsubscribed_count: stats.unsubscribes || 0,
        open_rate: openRate,
        click_rate: clickRate,
        bounce_rate: bounceRate,
        unsubscribe_rate: unsubscribeRate
      }

      // Update database
      const { error: updateError } = await supabaseAdmin
        .from('email_metrics')
        .update(metricsUpdate)
        .eq('issue_id', issueId)

      if (updateError) {
        throw new Error(`Failed to update metrics: ${updateError.message}`)
      }

      console.log(`[SendGrid] Updated metrics for issue ${issueId}:`, metricsUpdate)
      return metricsUpdate

    } catch (error) {
      console.error('[SendGrid] Error importing metrics:', error)
      return { skipped: true, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Add or update a contact in SendGrid
   */
  async upsertContact(
    email: string,
    data: {
      firstName?: string
      lastName?: string
      customFields?: Record<string, any>
      listIds?: string[]
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[SendGrid] Upserting contact: ${email}`)

      const contact: any = { email }
      if (data.firstName) contact.first_name = data.firstName
      if (data.lastName) contact.last_name = data.lastName
      if (data.customFields) contact.custom_fields = data.customFields

      const requestBody: any = {
        contacts: [contact]
      }

      if (data.listIds && data.listIds.length > 0) {
        requestBody.list_ids = data.listIds
      }

      const [response, body] = await sgClient.request({
        method: 'PUT',
        url: '/v3/marketing/contacts',
        body: requestBody
      })

      if (response.statusCode !== 202) {
        console.error('[SendGrid] Failed to upsert contact:', response.statusCode, body)
        return { success: false, error: `API error: ${response.statusCode}` }
      }

      console.log('[SendGrid] Contact upserted successfully:', email)
      return { success: true }

    } catch (error) {
      console.error('[SendGrid] Error upserting contact:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Update custom fields for a contact
   */
  async updateContactFields(
    email: string,
    fields: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    return this.upsertContact(email, { customFields: fields })
  }

  /**
   * Search for contacts by email addresses
   */
  async searchContactsByEmail(emails: string[]): Promise<{ result: Record<string, { contact: { id: string; email: string } }> } | null> {
    try {
      console.log(`[SendGrid] Searching for contacts by email: ${emails.join(', ')}`)

      const [response, body] = await sgClient.request({
        method: 'POST',
        url: '/v3/marketing/contacts/search/emails',
        body: { emails }
      })

      if (response.statusCode !== 200) {
        console.error('[SendGrid] Failed to search contacts:', response.statusCode, body)
        return null
      }

      return body as { result: Record<string, { contact: { id: string; email: string } }> }

    } catch (error) {
      console.error('[SendGrid] Error searching contacts:', error)
      return null
    }
  }

  /**
   * Remove a contact from a list
   */
  async removeContactFromList(contactId: string, listId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[SendGrid] Removing contact ${contactId} from list ${listId}`)

      const [response, body] = await sgClient.request({
        method: 'DELETE',
        url: `/v3/marketing/lists/${listId}/contacts`,
        qs: { contact_ids: contactId }
      })

      // 202 = accepted for processing, 404 = contact not in list (both are OK)
      if (response.statusCode !== 202 && response.statusCode !== 200 && response.statusCode !== 404) {
        console.error('[SendGrid] Failed to remove contact from list:', response.statusCode, body)
        return { success: false, error: `API error: ${response.statusCode}` }
      }

      console.log('[SendGrid] Contact removed from list successfully')
      return { success: true }

    } catch (error: any) {
      // 404 means contact not in list, which is fine
      if (error.code === 404) {
        return { success: true }
      }
      console.error('[SendGrid] Error removing contact from list:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Send a transactional email
   */
  async sendTransactionalEmail(
    to: string,
    subject: string,
    html: string,
    from: { email: string; name: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[SendGrid] Sending transactional email to ${to}`)

      await sgMail.send({
        to,
        from,
        subject,
        html
      })

      console.log('[SendGrid] Transactional email sent successfully')
      return { success: true }

    } catch (error) {
      console.error('[SendGrid] Error sending transactional email:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Send event approval email
   */
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
  }): Promise<{ success: boolean; error?: any }> {
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
      <h1 style="margin: 0;">Event Approved!</h1>
    </div>
    <div class="content">
      <p>Hi ${event.submitter_name},</p>
      <p>Great news! Your event submission has been approved and is now live.</p>

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

      <p>Your event will be featured in our newsletter. Thank you for your submission!</p>

      <p>Best regards,<br>The Newsletter Team</p>
    </div>
  </div>
</body>
</html>`

    return this.sendTransactionalEmail(
      event.submitter_email,
      `Your Event "${event.title}" Has Been Approved`,
      emailHtml,
      { email: 'noreply@example.com', name: 'Newsletter' }
    )
  }

  /**
   * Send event rejection email
   */
  async sendEventRejectionEmail(
    event: {
      title: string
      description: string
      start_date: string
      submitter_email: string
      submitter_name: string
    },
    reason?: string
  ): Promise<{ success: boolean; error?: any }> {
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
      <p>Thank you for submitting your event. After reviewing your submission, we're unable to approve it at this time.</p>

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

      <p>If you have questions or would like to resubmribe with changes, please feel free to reach out to us.</p>

      <p>Best regards,<br>The Newsletter Team</p>
    </div>
  </div>
</body>
</html>`

    return this.sendTransactionalEmail(
      event.submitter_email,
      `Event Submission Update: "${event.title}"`,
      emailHtml,
      { email: 'noreply@example.com', name: 'Newsletter' }
    )
  }

  /**
   * Generate email HTML content
   * Uses the same template generation as MailerLite service
   */
  private async generateEmailHTML(issue: IssueWithEvents, isReview: boolean): Promise<string> {
    // Filter active articles and sort by rank
    const activeArticles = issue.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    console.log('[SendGrid] Active articles to render:', activeArticles.length)

    // Fetch newsletter sections order
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch ad modules for this publication
    const { data: adModules } = await supabaseAdmin
      .from('ad_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch poll modules for this publication
    const { data: pollModules } = await supabaseAdmin
      .from('poll_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    console.log('[SendGrid] Active ad modules:', adModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('[SendGrid] Active poll modules:', pollModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))

    // Format date using local date parsing
    const [year, month, day] = issue.date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Generate header and footer
    const header = await generateNewsletterHeader(formattedDate, issue.date, undefined, issue.publication_id)
    const footer = await generateNewsletterFooter(issue.date, undefined, issue.publication_id)

    // Generate welcome section
    const welcomeHtml = await generateWelcomeSection(
      issue.welcome_intro || null,
      issue.welcome_tagline || null,
      issue.welcome_summary || null,
      issue.publication_id
    )

    // Review banner for review issues
    const reviewBanner = isReview ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin: 10px auto; max-width: 750px; background-color: #FEF3C7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 12px; text-align: center;">
      <h3 style="margin: 0; color: #92400E; font-size: 18px; font-weight: bold;">Newsletter Review</h3>
      <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">
        This is a preview of tomorrow's newsletter. Please review and make any necessary changes in the dashboard.
      </p>
    </td>
  </tr>
</table>
<br>` : ''

    // Section ID constants
    const SECTION_IDS = {
      AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
      PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b'
    }

    // Merge newsletter sections, ad modules, and poll modules into a single sorted list
    type SectionItem = { type: 'section'; data: any } | { type: 'ad_module'; data: any } | { type: 'poll_module'; data: any }
    const allItems: SectionItem[] = [
      ...(sections || []).map(s => ({ type: 'section' as const, data: s })),
      ...(adModules || []).map(m => ({ type: 'ad_module' as const, data: m })),
      ...(pollModules || []).map(m => ({ type: 'poll_module' as const, data: m }))
    ].sort((a, b) => (a.data.display_order ?? 999) - (b.data.display_order ?? 999))

    console.log('[SendGrid] Combined section order:', allItems.map(item =>
      `${item.data.name} (${item.type}, order: ${item.data.display_order})`
    ).join(', '))

    // Generate sections in order
    let sectionsHtml = ''
    for (const item of allItems) {
      if (item.type === 'ad_module') {
        // Generate ad module section using the global block library
        const { generateAdModulesSection } = await import('./newsletter-templates')
        const adModuleHtml = await generateAdModulesSection(issue, item.data.id)
        if (adModuleHtml) {
          sectionsHtml += adModuleHtml
        }
      } else if (item.type === 'poll_module') {
        // Generate poll module section using the poll modules library
        const { generatePollModulesSection } = await import('./newsletter-templates')
        const pollModuleHtml = await generatePollModulesSection(issue, item.data.id)
        if (pollModuleHtml) {
          sectionsHtml += pollModuleHtml
        }
      } else {
        const section = item.data
        if (section.section_type === 'primary_articles' && activeArticles.length > 0) {
          const { generatePrimaryArticlesSection } = await import('./newsletter-templates')
          const primaryHtml = await generatePrimaryArticlesSection(activeArticles, issue.date, issue.id, section.name, issue.publication_id, undefined)
          sectionsHtml += primaryHtml
        }
        else if (section.section_type === 'secondary_articles') {
          const { generateSecondaryArticlesSection } = await import('./newsletter-templates')
          const secondaryHtml = await generateSecondaryArticlesSection(issue, section.name)
          sectionsHtml += secondaryHtml
        }
        else if (section.section_type === 'ai_applications' || section.id === SECTION_IDS.AI_APPLICATIONS) {
          const { generateAIAppsSection } = await import('./newsletter-templates')
          const aiAppsHtml = await generateAIAppsSection(issue)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        else if (section.section_type === 'prompt_ideas' || section.id === SECTION_IDS.PROMPT_IDEAS) {
          const { generatePromptIdeasSection } = await import('./newsletter-templates')
          const promptHtml = await generatePromptIdeasSection(issue)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        // Note: 'poll' section_type is deprecated - polls are now handled via poll_modules
        else if (section.section_type === 'breaking_news') {
          const { generateBreakingNewsSection } = await import('./newsletter-templates')
          const breakingNewsHtml = await generateBreakingNewsSection(issue)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        }
        else if (section.section_type === 'beyond_the_feed') {
          const { generateBeyondTheFeedSection } = await import('./newsletter-templates')
          const beyondFeedHtml = await generateBeyondTheFeedSection(issue)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
        // Note: 'advertorial' section_type is deprecated - ads are now handled via ad_modules
      }
    }

    return reviewBanner + header + welcomeHtml + sectionsHtml + footer
  }

  private async logInfo(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'info',
        message,
        context,
        source: 'sendgrid_service'
      }])
  }

  private async logError(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message,
        context,
        source: 'sendgrid_service'
      }])
  }
}
