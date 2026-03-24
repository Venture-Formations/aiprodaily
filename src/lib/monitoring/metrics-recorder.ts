import { supabaseAdmin } from '@/lib/supabase'

/**
 * Lightweight internal metrics recorder.
 *
 * Records numeric metrics with optional tags to the system_metrics table.
 * Provides rolling-average deviation detection and retention cleanup.
 *
 * Usage:
 *   const metrics = new MetricsRecorder(publicationId)
 *   await metrics.record('ai_api_latency_ms', 450, { provider: 'openai', model: 'gpt-4o' })
 *   await metrics.recordTiming('workflow_duration_seconds', startMs, { step: 'generate' })
 */

export interface MetricDeviation {
  metric: string
  current: number
  avg: number
  stddev: number
  deviations: number
}

export class MetricsRecorder {
  constructor(private publicationId: string) {}

  /**
   * Record a single metric value.
   */
  async record(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    try {
      await supabaseAdmin
        .from('system_metrics')
        .insert({
          publication_id: this.publicationId,
          metric_name: name,
          metric_value: value,
          tags: tags || {},
          recorded_at: new Date().toISOString(),
        })
    } catch (error) {
      // Non-blocking: metrics failures should never break the caller
      console.error(`[Metrics] Failed to record ${name}:`, error)
    }
  }

  /**
   * Record elapsed time since startMs as a metric.
   */
  async recordTiming(name: string, startMs: number, tags?: Record<string, string>): Promise<void> {
    const elapsed = Date.now() - startMs
    await this.record(name, elapsed, tags)
  }

  /**
   * Delete metrics older than the retention period.
   * @returns number of deleted rows
   */
  static async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

      // Count first, then delete
      const { count: toDelete } = await supabaseAdmin
        .from('system_metrics')
        .select('id', { count: 'exact', head: true })
        .lt('recorded_at', cutoff)

      const { error } = await supabaseAdmin
        .from('system_metrics')
        .delete()
        .lt('recorded_at', cutoff)

      if (error) {
        console.error('[Metrics] Cleanup failed:', error)
        return 0
      }

      const deleted = toDelete ?? 0
      if (deleted > 0) {
        console.log(`[Metrics] Cleaned up ${deleted} rows older than ${retentionDays} days`)
      }
      return deleted
    } catch (error) {
      console.error('[Metrics] Cleanup error:', error)
      return 0
    }
  }

  /**
   * Get the rolling average and standard deviation for a metric over N days.
   */
  static async getRollingAverage(
    publicationId: string,
    metricName: string,
    days: number = 7
  ): Promise<{ avg: number; stddev: number; count: number }> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('system_metrics')
        .select('metric_value')
        .eq('publication_id', publicationId)
        .eq('metric_name', metricName)
        .gte('recorded_at', since)

      if (error || !data || data.length === 0) {
        return { avg: 0, stddev: 0, count: 0 }
      }

      const values = data.map(d => Number(d.metric_value))
      const count = values.length
      const avg = values.reduce((a, b) => a + b, 0) / count
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / count
      const stddev = Math.sqrt(variance)

      return { avg, stddev, count }
    } catch {
      return { avg: 0, stddev: 0, count: 0 }
    }
  }

  /**
   * Check all tracked metrics for the publication against their rolling averages.
   * Returns metrics that deviate by more than the threshold (default: 2 standard deviations).
   */
  static async checkDeviations(
    publicationId: string,
    thresholdStdDevs: number = 2,
    windowDays: number = 7
  ): Promise<MetricDeviation[]> {
    try {
      // Get the most recent value for each distinct metric
      const { data: recentMetrics } = await supabaseAdmin
        .from('system_metrics')
        .select('metric_name, metric_value, recorded_at')
        .eq('publication_id', publicationId)
        .order('recorded_at', { ascending: false })
        .limit(100)

      if (!recentMetrics || recentMetrics.length === 0) return []

      // Deduplicate to most recent per metric name
      const latestByMetric = new Map<string, number>()
      for (const row of recentMetrics) {
        if (!latestByMetric.has(row.metric_name)) {
          latestByMetric.set(row.metric_name, Number(row.metric_value))
        }
      }

      const deviations: MetricDeviation[] = []

      for (const [metricName, currentValue] of Array.from(latestByMetric.entries())) {
        const { avg, stddev, count } = await MetricsRecorder.getRollingAverage(
          publicationId,
          metricName,
          windowDays
        )

        // Need at least 5 data points for meaningful deviation detection
        if (count < 5 || stddev === 0) continue

        const numDeviations = Math.abs(currentValue - avg) / stddev

        if (numDeviations > thresholdStdDevs) {
          deviations.push({
            metric: metricName,
            current: Math.round(currentValue * 100) / 100,
            avg: Math.round(avg * 100) / 100,
            stddev: Math.round(stddev * 100) / 100,
            deviations: Math.round(numDeviations * 10) / 10,
          })
        }
      }

      return deviations
    } catch (error) {
      console.error('[Metrics] Deviation check error:', error)
      return []
    }
  }

  /**
   * Query metrics for a publication, optionally filtered by name and time range.
   * Returns data bucketed by hour for charting.
   */
  static async queryForChart(
    publicationId: string,
    metricName: string,
    days: number = 7
  ): Promise<Array<{ hour: string; avg: number; min: number; max: number; count: number }>> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabaseAdmin
        .from('system_metrics')
        .select('metric_value, recorded_at')
        .eq('publication_id', publicationId)
        .eq('metric_name', metricName)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })

      if (!data || data.length === 0) return []

      // Bucket by hour
      const buckets = new Map<string, number[]>()
      for (const row of data) {
        const hour = row.recorded_at.substring(0, 13) + ':00:00Z' // truncate to hour
        const values = buckets.get(hour) || []
        values.push(Number(row.metric_value))
        buckets.set(hour, values)
      }

      return Array.from(buckets.entries()).map(([hour, values]) => ({
        hour,
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100,
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        count: values.length,
      }))
    } catch {
      return []
    }
  }
}
