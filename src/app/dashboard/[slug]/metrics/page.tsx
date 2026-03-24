'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ChartData {
  hour: string
  avg: number
  min: number
  max: number
  count: number
}

interface MetricStats {
  avg: number
  stddev: number
  dataPoints: number
}

const METRIC_CONFIGS: Array<{
  name: string
  label: string
  unit: string
  color: string
  chartType: 'line' | 'bar'
}> = [
  { name: 'ai_api_latency_ms', label: 'AI API Latency', unit: 'ms', color: '#8b5cf6', chartType: 'line' },
  { name: 'workflow_duration_seconds', label: 'Workflow Duration', unit: 's', color: '#3b82f6', chartType: 'bar' },
  { name: 'rss_feed_fetch_duration_ms', label: 'RSS Feed Fetch', unit: 'ms', color: '#10b981', chartType: 'line' },
  { name: 'mailerlite_send_success', label: 'Send Success Rate', unit: '', color: '#f59e0b', chartType: 'bar' },
  { name: 'article_count_per_issue', label: 'Articles per Issue', unit: '', color: '#ef4444', chartType: 'bar' },
]

function MetricCard({ metricConfig, publicationId, days }: {
  metricConfig: typeof METRIC_CONFIGS[0]
  publicationId: string
  days: number
}) {
  const [data, setData] = useState<ChartData[]>([])
  const [stats, setStats] = useState<MetricStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/metrics?publication_id=${publicationId}&metric=${metricConfig.name}&days=${days}`
        )
        if (!res.ok) return
        const json = await res.json()
        setData(json.data || [])
        setStats(json.stats || null)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    if (publicationId) fetchData()
  }, [publicationId, metricConfig.name, days])

  const formatHour = (hour: string) => {
    const d = new Date(hour)
    return `${(d.getMonth() + 1)}/${d.getDate()} ${d.getHours()}:00`
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{metricConfig.label}</h3>
        {stats && stats.dataPoints > 0 && (
          <div className="text-xs text-gray-500">
            avg: {stats.avg.toFixed(1)}{metricConfig.unit} | {stats.dataPoints} points
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          {metricConfig.chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                labelFormatter={(label: any) => formatHour(String(label))}
                formatter={(value: any) => [`${value}${metricConfig.unit}`, metricConfig.label]}
              />
              <Line type="monotone" dataKey="avg" stroke={metricConfig.color} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                labelFormatter={(label: any) => formatHour(String(label))}
                formatter={(value: any) => [`${value}${metricConfig.unit}`, metricConfig.label]}
              />
              <Bar dataKey="avg" fill={metricConfig.color} radius={[2, 2, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function MetricsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([])

  useEffect(() => {
    if (!slug) return
    fetch('/api/newsletters')
      .then(res => res.json())
      .then(data => {
        const pub = (data.newsletters || []).find((n: { slug: string }) => n.slug === slug)
        if (pub) setPublicationId(pub.id)
      })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    if (!publicationId) return
    fetch(`/api/metrics?publication_id=${publicationId}`)
      .then(res => res.json())
      .then(data => setAvailableMetrics(data.metrics || []))
      .catch(() => {})
  }, [publicationId])

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">System Metrics</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Time range:</span>
            {[1, 7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm rounded ${
                  days === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {!publicationId ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Known metric charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {METRIC_CONFIGS.map(config => (
                <MetricCard
                  key={config.name}
                  metricConfig={config}
                  publicationId={publicationId}
                  days={days}
                />
              ))}
            </div>

            {/* Additional discovered metrics */}
            {availableMetrics.filter(m => !METRIC_CONFIGS.some(c => c.name === m)).length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Metrics</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {availableMetrics
                    .filter(m => !METRIC_CONFIGS.some(c => c.name === m))
                    .map(metricName => (
                      <MetricCard
                        key={metricName}
                        metricConfig={{
                          name: metricName,
                          label: metricName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                          unit: '',
                          color: '#6b7280',
                          chartType: 'line',
                        }}
                        publicationId={publicationId}
                        days={days}
                      />
                    ))}
                </div>
              </div>
            )}

            {availableMetrics.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
                <p className="text-lg mb-2">No metrics recorded yet</p>
                <p className="text-sm">Metrics will be recorded automatically as workflows run, AI calls are made, and emails are sent.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
