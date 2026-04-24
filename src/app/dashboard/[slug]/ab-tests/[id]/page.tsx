'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

interface Test {
  id: string
  name: string
  status: 'draft' | 'active' | 'ended'
  start_date: string | null
  end_date: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

interface VariantWithPage {
  id: string
  label: string
  weight: number
  display_order: number
  page: { id: string; name: string; content: Record<string, string | undefined> }
}

interface StatsRow {
  variant_id: string
  label: string
  weight: number
  page_name?: string
  page_views: number
  signups: number
  reached_offers: number
  completed_info: number
  sparkloop_signups: number
}

interface Newsletter { id: string; slug: string; name: string }

const MIN_VIEWS_FOR_RATE = 50

function rate(numer: number, denom: number): string {
  if (denom < MIN_VIEWS_FOR_RATE) return '—'
  return `${((numer / denom) * 100).toFixed(1)}%`
}

function StatusPill({ status }: { status: Test['status'] }) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'draft'
      ? 'bg-gray-100 text-gray-700'
      : 'bg-slate-200 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

export default function AbTestDetailPage() {
  const { slug, id } = useParams() as { slug: string; id: string }
  const router = useRouter()
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [test, setTest] = useState<Test | null>(null)
  const [variants, setVariants] = useState<VariantWithPage[]>([])
  const [stats, setStats] = useState<StatsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const publicationId = newsletter?.id

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/newsletters')
      const json = await res.json()
      const found = (json.newsletters || []).find((n: Newsletter) => n.slug === slug)
      setNewsletter(found || null)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!publicationId) return
    fetchAll()
  }, [publicationId, id])

  async function fetchAll() {
    if (!publicationId) return
    setLoading(true)
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/ab-tests/${id}?publication_id=${publicationId}`),
      fetch(`/api/ab-tests/${id}/stats?publication_id=${publicationId}`),
    ])
    const t = await tRes.json()
    const s = await sRes.json()
    setTest(t.test || null)
    setVariants(t.variants || [])
    setStats(s.stats || [])
    setLoading(false)
  }

  async function lifecycle(action: 'start' | 'end') {
    if (!publicationId || !test) return
    if (action === 'end' && !confirm('End this test? Further visitors will not count toward it.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ab-tests/${test.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publication_id: publicationId, action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `${action} failed`)
      }
      await fetchAll()
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function reuseInNewTest() {
    if (!test) return
    // Send user to /new — they'll re-pick the pages. Simple + keeps code paths unified.
    router.push(`/dashboard/${slug}/ab-tests/new`)
  }

  if (loading) {
    return <Layout><div className="text-center py-16 text-gray-500">Loading…</div></Layout>
  }
  if (!test) {
    return <Layout><div className="text-center py-16 text-gray-500">Test not found.</div></Layout>
  }

  const totalPageViews = stats.reduce((sum, s) => sum + s.page_views, 0)

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0 max-w-5xl">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li><Link href={`/dashboard/${slug}/ab-tests`} className="text-gray-500 hover:text-gray-700">A/B Tests</Link></li>
            <li><span className="text-gray-500">/</span></li>
            <li><span className="text-gray-900 font-medium truncate max-w-md inline-block">{test.name}</span></li>
          </ol>
        </nav>

        <div className="flex items-center justify-between mt-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{test.name}</h1>
              <StatusPill status={test.status} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Created {new Date(test.created_at).toLocaleString()}
              {test.started_at && ` • Started ${new Date(test.started_at).toLocaleString()}`}
              {test.ended_at && ` • Ended ${new Date(test.ended_at).toLocaleString()}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {test.status === 'draft' && (
              <button
                onClick={() => lifecycle('start')}
                disabled={busy}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Start Test
              </button>
            )}
            {test.status === 'active' && (
              <button
                onClick={() => lifecycle('end')}
                disabled={busy}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                End Test
              </button>
            )}
            {test.status === 'ended' && (
              <button
                onClick={reuseInNewTest}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Use pages in new test
              </button>
            )}
          </div>
        </div>

        {totalPageViews < MIN_VIEWS_FOR_RATE && (
          <div className="mb-4 text-xs text-gray-500">
            Conversion rates will appear once a variant reaches {MIN_VIEWS_FOR_RATE} page views.
          </div>
        )}

        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Variant</th>
                <th className="text-left px-3 py-2">Page</th>
                <th className="text-right px-3 py-2">Weight</th>
                <th className="text-right px-3 py-2">Page Views</th>
                <th className="text-right px-3 py-2">Signups</th>
                <th className="text-right px-3 py-2">Signup %</th>
                <th className="text-right px-3 py-2">Reached Offers</th>
                <th className="text-right px-3 py-2">Completed Info</th>
                <th className="text-right px-3 py-2">SparkLoop Signups</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map(v => {
                const s = stats.find(r => r.variant_id === v.id)
                const pageViews = s?.page_views || 0
                const signups = s?.signups || 0
                return (
                  <tr key={v.id}>
                    <td className="px-3 py-2 font-medium">{v.label}</td>
                    <td className="px-3 py-2 text-gray-700">{v.page?.name || '—'}</td>
                    <td className="px-3 py-2 text-right">{v.weight}</td>
                    <td className="px-3 py-2 text-right">{pageViews}</td>
                    <td className="px-3 py-2 text-right">{signups}</td>
                    <td className="px-3 py-2 text-right">{rate(signups, pageViews)}</td>
                    <td className="px-3 py-2 text-right">{s?.reached_offers ?? 0}</td>
                    <td className="px-3 py-2 text-right">{s?.completed_info ?? 0}</td>
                    <td className="px-3 py-2 text-right">{s?.sparkloop_signups ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Bot user-agents are excluded automatically. IPs listed in the excluded_ips table are filtered from all counts above.
        </p>
      </div>
    </Layout>
  )
}
