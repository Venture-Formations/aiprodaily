import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { triageAlert, isTriageEnabled } from './monitoring/alert-triage'

export class SlackNotificationService {
  private webhookUrl: string

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || ''
  }

  private async isNotificationEnabled(notificationType: string): Promise<boolean> {
    try {
      const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', `slack_${notificationType}_enabled`)
        .single()

      return setting?.value === 'true'
    } catch (error) {
      // Default to enabled if setting doesn't exist
      return true
    }
  }

  private async getWebhookUrl(): Promise<string> {
    try {
      const { data: setting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'slack_webhook_url')
        .single()

      return setting?.value || this.webhookUrl
    } catch (error) {
      return this.webhookUrl
    }
  }

  async sendSimpleMessage(message: string) {
    if (!this.webhookUrl) {
      console.warn('Slack webhook URL not configured')
      return
    }

    try {
      const payload = {
        text: message
      }

      await axios.post(this.webhookUrl, payload)

      // Log the notification
      await supabaseAdmin
        .from('system_logs')
        .insert([{
          level: 'info',
          message: 'Simple Slack message sent',
          context: { message },
          source: 'slack_service'
        }])

    } catch (error) {
      console.error('Failed to send simple Slack message:', error)

      // Log the failure
      await supabaseAdmin
        .from('system_logs')
        .insert([{
          level: 'error',
          message: 'Failed to send simple Slack message',
          context: {
            message,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          source: 'slack_service'
        }])
    }
  }

  async sendAlert(message: string, level: 'info' | 'warn' | 'error' = 'info', notificationType?: string) {
    const webhookUrl = await this.getWebhookUrl()
    if (!webhookUrl) {
      console.warn('Slack webhook URL not configured')
      return
    }

    // Check if this notification type is enabled
    if (notificationType && !(await this.isNotificationEnabled(notificationType))) {
      console.log(`Slack notification skipped - ${notificationType} is disabled`)
      return
    }

    // AI triage: classify alert before sending (opt-in, fail-open)
    let finalMessage = message
    let finalLevel = level
    try {
      if (await isTriageEnabled()) {
        const triageResult = await triageAlert(message, level, notificationType)
        if (triageResult) {
          if (triageResult.classification === 'auto_resolve') {
            // Log but don't send to Slack
            console.log(`[AlertTriage] Auto-resolved: ${triageResult.reasoning}`)
            await supabaseAdmin
              .from('system_logs')
              .insert([{
                level: 'info',
                message: 'Alert auto-resolved by triage',
                context: { originalMessage: message, level, notificationType, reasoning: triageResult.reasoning },
                source: 'alert_triage'
              }])
            return
          }
          if (triageResult.classification === 'investigate') {
            finalMessage = `[Low Priority] ${message}`
          }
          // 'critical' — send as-is
        }
        // null result (timeout/error) — send as-is (fail-open)
      }
    } catch (triageError) {
      // Triage failure must never block alerts
      console.error('[AlertTriage] Triage error, sending alert normally:', triageError)
    }

    try {
      const emoji = {
        info: ':information_source:',
        warn: ':warning:',
        error: ':rotating_light:'
      }[finalLevel]

      const payload = {
        text: `${emoji} ${finalMessage}`
      }

      await axios.post(webhookUrl, payload)

      // Log the notification
      await supabaseAdmin
        .from('system_logs')
        .insert([{
          level: 'info',
          message: 'Slack notification sent',
          context: { originalMessage: message, level, notificationType },
          source: 'slack_service'
        }])

    } catch (error) {
      console.error('Failed to send Slack notification:', error)

      // Log the failure
      await supabaseAdmin
        .from('system_logs')
        .insert([{
          level: 'error',
          message: 'Failed to send Slack notification',
          context: {
            originalMessage: message,
            level,
            notificationType,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          source: 'slack_service'
        }])
    }
  }

  async sendRSSProcessingAlert(success: boolean, issueId?: string, error?: string) {
    if (success) {
      await this.sendAlert(
        `RSS processing completed successfully${issueId ? ` for issue ${issueId}` : ''}`,
        'info',
        'rss_processing_updates'
      )
    } else {
      await this.sendAlert(
        `RSS processing failed: ${error}`,
        'error',
        'rss_processing_updates'
      )
    }
  }

  async sendEmailIssueAlert(type: 'review' | 'final', success: boolean, issueId: string, error?: string) {
    const actionText = type === 'review' ? 'Review issue' : 'Final issue'

    if (success) {
      await this.sendAlert(
        `${actionText} sent successfully for issue ${issueId}`,
        'info',
        'email_delivery_updates'
      )
    } else {
      await this.sendAlert(
        `${actionText} failed for issue ${issueId}: ${error}`,
        'error',
        'email_delivery_updates'
      )
    }
  }

  async sendSystemAlert(message: string, level: 'info' | 'warn' | 'error') {
    await this.sendAlert(`System Alert: ${message}`, level, 'system_errors')
  }

  async sendHealthCheckAlert(component: string, status: 'healthy' | 'degraded' | 'down', details?: string) {
    const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error'
    const message = `Health Check: ${component} is ${status}${details ? ` - ${details}` : ''}`

    await this.sendAlert(message, level, 'health_check_alerts')
  }

  /**
   * Alert when RSS processing doesn't complete fully
   */
  async sendRSSIncompleteAlert(issueId: string, completedSteps: string[], failedStep: string, error?: string) {
    const message = [
      `🚨 RSS Processing Incomplete for issue ${issueId}`,
      ``,
      `✅ Completed: ${completedSteps.join(', ')}`,
      `❌ Failed at: ${failedStep}`,
      error ? `Error: ${error}` : '',
      ``,
      `⚠️ issue may be missing content or in invalid state`
    ].filter(Boolean).join('\n')

    await this.sendAlert(message, 'error', 'rss_processing_incomplete')
  }

  /**
   * Alert when issue has 6 or fewer articles available
   */
  async sendLowArticleCountAlert(issueId: string, articleCount: number, issueDate: string) {
    const message = [
      `⚠️ 📰 Low Article Count Alert`,
      ``,
      `issue: ${issueId}`,
      `Date: ${issueDate}`,
      `Article Count: ${articleCount} articles (≤6 threshold)`,
      ``,
      `⚠️ Newsletter may not have enough content for quality delivery`,
      `🔍 Action Required: Manual review before sending`
    ].join('\n')

    await this.sendAlert(message, 'warn', 'low_article_count')
  }

  /**
   * Alert when scheduled send fires but nothing was sent to MailerLite
   */
  async sendScheduledSendFailureAlert(issueId: string, scheduledTime: string, reason?: string, details?: any) {
    const message = [
      `📅 Scheduled Send Failed`,
      ``,
      `issue: ${issueId}`,
      `Scheduled Time: ${scheduledTime}`,
      `Status: Send triggered but no email delivered to MailerLite`,
      reason ? `Reason: ${reason}` : '',
      ``,
      `🔍 Check issue status, MailerLite configuration, and logs`,
      details ? `Details: ${JSON.stringify(details, null, 2)}` : ''
    ].filter(Boolean).join('\n')

    await this.sendAlert(message, 'error', 'scheduled_send_failure')
  }

  /**
   * Enhanced RSS processing alert with article count monitoring
   */
  async sendRSSProcessingCompleteAlert(issueId: string, articleCount: number, issueDate: string, includeArchiveInfo?: { archivedArticles: number; archivedPosts: number; archivedRatings: number }) {
    const lowCountWarning = articleCount <= 6

    const message = [
      `${lowCountWarning ? '⚠️' : '✅'} RSS Processing Complete`,
      ``,
      `issue: ${issueId}`,
      `Date: ${issueDate}`,
      `Articles Generated: ${articleCount}`,
      lowCountWarning ? `⚠️ Warning: Low article count (≤6)` : '',
      ``,
      includeArchiveInfo ? `📁 Archive: ${includeArchiveInfo.archivedArticles} articles, ${includeArchiveInfo.archivedPosts} posts preserved` : '',
      `📧 Ready for review and scheduling`
    ].filter(Boolean).join('\n')

    // Send as warning if article count is low, otherwise info
    await this.sendAlert(message, lowCountWarning ? 'warn' : 'info', 'rss_processing_updates')

    // Send separate low article count alert if needed
    if (lowCountWarning) {
      await this.sendLowArticleCountAlert(issueId, articleCount, issueDate)
    }
  }

  /**
   * Send a daily system health digest from log analysis.
   */
  async sendDailyDigestAlert(report: {
    reportDate: string
    summary: string
    anomalies: Array<{ description: string; severity: string; source: string; count: number }>
    recommendations: Array<{ action: string; priority: string; reasoning: string }>
  }) {
    const anomalyLines = report.anomalies.length > 0
      ? report.anomalies.map(a => `• [${a.severity.toUpperCase()}] ${a.description} (${a.source}, ${a.count}x)`).join('\n')
      : '• No anomalies detected'

    const recLines = report.recommendations.length > 0
      ? report.recommendations.map(r => `• [${r.priority.toUpperCase()}] ${r.action}`).join('\n')
      : '• No recommendations'

    const hasIssues = report.anomalies.some(a => a.severity === 'high')

    const message = [
      `${hasIssues ? '⚠️' : '📊'} Daily System Health Digest — ${report.reportDate}`,
      '',
      report.summary,
      '',
      '*Anomalies:*',
      anomalyLines,
      '',
      '*Recommendations:*',
      recLines,
    ].join('\n')

    await this.sendAlert(message, hasIssues ? 'warn' : 'info', 'system_errors')
  }
}

// Error handler utility
export class ErrorHandler {
  private slack: SlackNotificationService

  constructor() {
    this.slack = new SlackNotificationService()
  }

  async handleError(error: Error | unknown, context: {
    source: string
    operation?: string
    issueId?: string
    userId?: string
    [key: string]: any
  }) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log to database
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message: errorMessage,
        context: {
          ...context,
          stack: errorStack
        },
        source: context.source
      }])

    // Send Slack alert for critical errors
    if (this.isCriticalError(context.source, errorMessage)) {
      await this.slack.sendAlert(
        `Critical error in ${context.source}${context.operation ? ` during ${context.operation}` : ''}: ${errorMessage}`,
        'error',
        'system_errors'
      )
    }

    const errorDetails = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
    console.error(`Error in ${context.source}:`, errorDetails)
  }

  private isCriticalError(source: string, message: string): boolean {
    const criticalSources = ['rss_processor', 'mailerlite_service', 'auth_system']
    const criticalKeywords = ['failed to process', 'authentication failed', 'database error', 'api timeout']

    return criticalSources.includes(source) ||
           criticalKeywords.some(keyword => message.toLowerCase().includes(keyword))
  }

  async logInfo(message: string, context: Record<string, any> = {}, source: string = 'system') {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'info',
        message,
        context,
        source
      }])
  }

  async logWarning(message: string, context: Record<string, any> = {}, source: string = 'system') {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'warn',
        message,
        context,
        source
      }])

    // Send Slack notification for warnings
    await this.slack.sendAlert(`Warning: ${message}`, 'warn', 'system_errors')
  }
}

// Health monitoring utilities
export class HealthMonitor {
  private slack: SlackNotificationService
  private errorHandler: ErrorHandler

  constructor() {
    this.slack = new SlackNotificationService()
    this.errorHandler = new ErrorHandler()
  }

  async checkRSSFeeds() {
    try {
      const { data: feeds, error } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('active', true)

      if (error) throw error

      const failedFeeds = feeds.filter(feed => feed.processing_errors > 5)

      if (failedFeeds.length > 0) {
        await this.slack.sendHealthCheckAlert(
          'RSS Feeds',
          'degraded',
          `${failedFeeds.length} feeds have multiple processing errors`
        )
      }

      return { healthy: failedFeeds.length === 0, failedFeeds }
    } catch (error) {
      await this.errorHandler.handleError(error, {
        source: 'health_monitor',
        operation: 'checkRSSFeeds'
      })
      return { healthy: false, error }
    }
  }

  async checkDatabaseConnection() {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_logs')
        .select('id')
        .limit(1)

      if (error) throw error

      return { healthy: true }
    } catch (error) {
      await this.slack.sendHealthCheckAlert(
        'Database',
        'down',
        'Unable to connect to Supabase database'
      )
      return { healthy: false, error }
    }
  }

  async checkRecentProcessing() {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const { data: issues, error } = await supabaseAdmin
        .from('publication_issues')
        .select('*')
        .gte('created_at', yesterday.toISOString())

      if (error) throw error

      if (issues.length === 0) {
        await this.slack.sendHealthCheckAlert(
          'RSS Processing',
          'degraded',
          'No issues created in the last 24 hours'
        )
        return { healthy: false, reason: 'No recent issues' }
      }

      return { healthy: true, recentCampaigns: issues.length }
    } catch (error) {
      await this.errorHandler.handleError(error, {
        source: 'health_monitor',
        operation: 'checkRecentProcessing'
      })
      return { healthy: false, error }
    }
  }

  async runFullHealthCheck() {
    const results = {
      database: await this.checkDatabaseConnection(),
      rssFeeds: await this.checkRSSFeeds(),
      recentProcessing: await this.checkRecentProcessing(),
      timestamp: new Date().toISOString()
    }

    const overallHealth = Object.values(results).every(result =>
      typeof result === 'object' && 'healthy' in result ? result.healthy : true
    )

    await this.errorHandler.logInfo('Health check completed', {
      results,
      overallHealth
    }, 'health_monitor')

    if (!overallHealth) {
      await this.slack.sendAlert(
        'System health check failed - some components are not healthy',
        'warn',
        'health_check_alerts'
      )
    }

    return results
  }
}