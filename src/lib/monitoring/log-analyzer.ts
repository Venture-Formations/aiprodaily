import { supabaseAdmin } from '@/lib/supabase'
import { callAIWithPrompt } from '@/lib/openai/core'
import type { Logger } from 'pino'

/**
 * Log Analyzer — Proactive daily analysis of system_logs
 *
 * Aggregates error counts, detects new error types, and passes a summary
 * to AI for anomaly detection and recommendations.
 */

export interface LogAnomaly {
  description: string
  severity: 'low' | 'medium' | 'high'
  source: string
  count: number
}

export interface LogRecommendation {
  action: string
  priority: 'low' | 'medium' | 'high'
  reasoning: string
}

export interface LogAnalysisReport {
  reportDate: string
  anomalies: LogAnomaly[]
  recommendations: LogRecommendation[]
  summary: string
  errorCounts: Record<string, number>
  newErrorTypes: string[]
}

/** Inline fallback prompt used if ai_log_analysis isn't in the database yet */
const FALLBACK_PROMPT = JSON.stringify({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are a systems reliability engineer analyzing 24h of newsletter platform logs. Identify anomalies, new error types, increasing error rates, and potential issues. Return JSON: {"anomalies":[{"description":"...","severity":"low|medium|high","source":"...","count":0}],"recommendations":[{"action":"...","priority":"low|medium|high","reasoning":"..."}],"summary":"..."}',
    },
    {
      role: 'user',
      content: 'Log summary for {{report_date}}:\n\nError counts by source:\n{{error_counts}}\n\nNew error types (not seen in prior 7 days):\n{{new_errors}}\n\nTop 20 error messages:\n{{top_errors}}\n\nRecent remediation actions:\n{{remediation_summary}}\n\nAnalyze and recommend.',
    },
  ],
  temperature: 0.3,
  max_tokens: 1000,
})

export class LogAnalyzer {
  constructor(
    private publicationId: string,
    private logger: Logger
  ) {}

  /**
   * Run the full daily analysis for this publication.
   */
  async analyze(date: string): Promise<LogAnalysisReport> {
    const since = `${date}T00:00:00Z`
    const until = `${date}T23:59:59Z`
    const priorSince = new Date(new Date(since).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Gather data in parallel
    const [errorCounts, newErrorTypes, topErrors, remediationSummary] = await Promise.all([
      this.getErrorCounts(since, until),
      this.getNewErrorTypes(since, priorSince),
      this.getTopErrors(since, 20),
      this.getRemediationSummary(since),
    ])

    // Format for AI prompt
    const errorCountsText = Object.entries(errorCounts)
      .map(([source, count]) => `${source}: ${count}`)
      .join('\n') || '(no errors)'

    const newErrorsText = newErrorTypes.length > 0
      ? newErrorTypes.join('\n')
      : '(no new error types)'

    const topErrorsText = topErrors
      .map(e => `[${e.count}x] ${e.message}`)
      .join('\n') || '(no errors)'

    // Call AI for analysis
    const aiResult = await callAIWithPrompt(
      'ai_log_analysis',
      this.publicationId,
      {
        report_date: date,
        error_counts: errorCountsText,
        new_errors: newErrorsText,
        top_errors: topErrorsText,
        remediation_summary: remediationSummary,
      },
      FALLBACK_PROMPT
    )

    // Parse AI response
    const parsed = this.parseAIResponse(aiResult)

    const report: LogAnalysisReport = {
      reportDate: date,
      anomalies: parsed.anomalies || [],
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || 'No significant issues detected.',
      errorCounts,
      newErrorTypes,
    }

    // Store report
    await this.storeReport(report)

    this.logger.info(
      { anomalies: report.anomalies.length, recommendations: report.recommendations.length },
      `[LogAnalysis] Report for ${date} complete`
    )

    return report
  }

  /**
   * Count errors grouped by source for the given time range.
   */
  private async getErrorCounts(since: string, until: string): Promise<Record<string, number>> {
    try {
      const { data } = await supabaseAdmin
        .from('system_logs')
        .select('source')
        .in('level', ['error', 'warn'])
        .gte('timestamp', since)
        .lte('timestamp', until)

      if (!data) return {}

      const counts: Record<string, number> = {}
      for (const row of data) {
        const source = row.source || 'unknown'
        counts[source] = (counts[source] || 0) + 1
      }
      return counts
    } catch (error) {
      this.logger.error({ err: error }, '[LogAnalysis] Failed to get error counts')
      return {}
    }
  }

  /**
   * Find error messages that appeared today but not in the prior 7 days.
   */
  private async getNewErrorTypes(since: string, priorSince: string): Promise<string[]> {
    try {
      // Get today's unique error messages
      const { data: todayErrors } = await supabaseAdmin
        .from('system_logs')
        .select('message')
        .eq('level', 'error')
        .gte('timestamp', since)

      if (!todayErrors || todayErrors.length === 0) return []

      const todayMessages = Array.from(new Set(todayErrors.map(r => r.message)))

      // Get prior 7 days' unique error messages
      const { data: priorErrors } = await supabaseAdmin
        .from('system_logs')
        .select('message')
        .eq('level', 'error')
        .gte('timestamp', priorSince)
        .lt('timestamp', since)

      const priorMessages = new Set((priorErrors || []).map(r => r.message))

      // Return messages that are new
      return todayMessages.filter(m => !priorMessages.has(m)).slice(0, 20)
    } catch (error) {
      this.logger.error({ err: error }, '[LogAnalysis] Failed to get new error types')
      return []
    }
  }

  /**
   * Get the top N most frequent error messages for the period.
   */
  private async getTopErrors(since: string, limit: number): Promise<Array<{ message: string; count: number }>> {
    try {
      const { data } = await supabaseAdmin
        .from('system_logs')
        .select('message')
        .eq('level', 'error')
        .gte('timestamp', since)

      if (!data) return []

      // Count occurrences
      const counts: Record<string, number> = {}
      for (const row of data) {
        const msg = row.message?.substring(0, 200) || 'unknown'
        counts[msg] = (counts[msg] || 0) + 1
      }

      return Object.entries(counts)
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
    } catch (error) {
      this.logger.error({ err: error }, '[LogAnalysis] Failed to get top errors')
      return []
    }
  }

  /**
   * Summarize recent remediation actions for the AI.
   */
  private async getRemediationSummary(since: string): Promise<string> {
    try {
      const { data } = await supabaseAdmin
        .from('remediation_log')
        .select('playbook_name, result, action_taken, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!data || data.length === 0) return '(no remediation actions)'

      return data
        .map(r => `[${r.result}] ${r.playbook_name}: ${r.action_taken}`)
        .join('\n')
    } catch {
      return '(unable to fetch remediation data)'
    }
  }

  /**
   * Parse the AI response, handling various response formats.
   */
  private parseAIResponse(aiResult: any): { anomalies: LogAnomaly[]; recommendations: LogRecommendation[]; summary: string } {
    const empty = { anomalies: [], recommendations: [], summary: '' }
    try {
      let parsed: any

      if (typeof aiResult === 'string') {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return empty
        parsed = JSON.parse(jsonMatch[0])
      } else if (typeof aiResult === 'object') {
        if (aiResult.raw) {
          const jsonMatch = aiResult.raw.match(/\{[\s\S]*\}/)
          if (!jsonMatch) return empty
          parsed = JSON.parse(jsonMatch[0])
        } else {
          parsed = aiResult
        }
      } else {
        return empty
      }

      return {
        anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        summary: parsed.summary || '',
      }
    } catch {
      return empty
    }
  }

  /**
   * Store the analysis report in the database.
   */
  private async storeReport(report: LogAnalysisReport): Promise<void> {
    try {
      await supabaseAdmin
        .from('log_analysis_reports')
        .upsert(
          {
            publication_id: this.publicationId,
            report_date: report.reportDate,
            anomalies: report.anomalies,
            recommendations: report.recommendations,
            summary: report.summary,
            error_counts: report.errorCounts,
            new_error_types: report.newErrorTypes,
          },
          { onConflict: 'publication_id,report_date' }
        )
    } catch (error) {
      this.logger.error({ err: error }, '[LogAnalysis] Failed to store report')
    }
  }
}
