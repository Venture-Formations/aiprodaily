'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'

interface AbTest {
  id: string
  name: string
  status: 'draft' | 'active' | 'ended'
  start_date: string | null
  end_date: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

interface Newsletter { id: string; slug: string; name: string }

function StatusPill({ status }: { status: AbTest['status'] }) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'draft'
      ? 'bg-gray-100 text-gray-700'
      : 'bg-slate-200 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

export default function AbTestsDashboardPage() {
  const { slug } = useParams() as { slug: string }
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [tests, setTests] = useState<AbTest[]>([])
  const [loading, setLoading] = useState(true)

  const publicationId = newsletter?.id

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/newsletters')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const found = (json.newsletters || []).find((n: Newsletter) => n.slug === slug)
        setNewsletter(found || null)
        if (!found) setLoading(false)
      } catch (err) {
        console.error('[AbTestsList] newsletter load failed', err)
        setNewsletter(null)
        setLoading(false)
      }
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!publicationId) return
    async function fetchTests() {
      setLoading(true)
      try {
        const res = await fetch(`/api/ab-tests?publication_id=${publicationId}`)
        const json = await res.json()
        setTests(json.tests || [])
      } catch (err) {
        console.error('[AbTestsList] fetchTests failed', err)
        setTests([])
      } finally {
        setLoading(false)
      }
    }
    fetchTests()
  }, [publicationId])

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li><Link href={`/dashboard/${slug}`} className="text-gray-500 hover:text-gray-700">Dashboard</Link></li>
                <li><span className="text-gray-500">/</span></li>
                <li><span className="text-gray-900 font-medium">A/B Tests</span></li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Subscribe Page A/B Tests</h1>
            <p className="text-gray-600">Compare subscribe-page variants. Stats reset per test.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/${slug}/subscribe-pages`} className="text-sm text-brand-primary hover:underline">
              Manage pages →
            </Link>
            <Link
              href={`/dashboard/${slug}/ab-tests/new`}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              New Test
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg">
            No tests yet.
          </div>
        ) : (
          <ul className="divide-y border rounded-lg bg-white">
            {tests.map(t => (
              <li key={t.id} className="px-4 py-3">
                <Link href={`/dashboard/${slug}/ab-tests/${t.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-4 px-4 py-1 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{t.name}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Created {new Date(t.created_at).toLocaleDateString()}
                      {t.started_at && ` • Started ${new Date(t.started_at).toLocaleDateString()}`}
                      {t.ended_at && ` • Ended ${new Date(t.ended_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <span className="text-brand-primary text-sm">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
