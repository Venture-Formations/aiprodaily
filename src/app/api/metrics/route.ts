import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { MetricsRecorder } from '@/lib/monitoring/metrics-recorder'

/**
 * GET /api/metrics?publication_id=...&metric=...&days=7
 * Query metrics for charting. Returns hourly-bucketed data.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'metrics', requirePublicationId: true },
  async ({ publicationId, request }) => {
    const url = new URL(request.url)
    const metricName = url.searchParams.get('metric')
    const days = parseInt(url.searchParams.get('days') || '7', 10)

    if (!metricName) {
      // Return available metric names
      const { data } = await (await import('@/lib/supabase')).supabaseAdmin
        .from('system_metrics')
        .select('metric_name')
        .eq('publication_id', publicationId!)
        .order('recorded_at', { ascending: false })
        .limit(500)

      const uniqueNames = Array.from(new Set((data || []).map(d => d.metric_name)))
      return NextResponse.json({ metrics: uniqueNames })
    }

    const chartData = await MetricsRecorder.queryForChart(publicationId!, metricName, days)

    // Also get rolling stats
    const stats = await MetricsRecorder.getRollingAverage(publicationId!, metricName, days)

    return NextResponse.json({
      metric: metricName,
      days,
      stats: {
        avg: stats.avg,
        stddev: stats.stddev,
        dataPoints: stats.count,
      },
      data: chartData,
    })
  }
)
