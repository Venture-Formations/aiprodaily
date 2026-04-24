'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

interface SubscribePage {
  id: string
  name: string
}
interface Newsletter { id: string; slug: string; name: string }

interface VariantRow {
  page_id: string
  label: string
  weight: number
}

export default function NewAbTestPage() {
  const { slug } = useParams() as { slug: string }
  const router = useRouter()
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [pages, setPages] = useState<SubscribePage[]>([])
  const [name, setName] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([
    { page_id: '', label: 'A', weight: 50 },
    { page_id: '', label: 'B', weight: 50 },
  ])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activate, setActivate] = useState(false)
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
    async function loadPages() {
      const res = await fetch(`/api/subscribe-pages?publication_id=${publicationId}`)
      const json = await res.json()
      setPages(json.pages || [])
    }
    loadPages()
  }, [publicationId])

  function setVariant(idx: number, patch: Partial<VariantRow>) {
    setVariants(v => v.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  function addVariant() {
    const nextLabel = String.fromCharCode(65 + variants.length) // C, D, …
    setVariants(v => [...v, { page_id: '', label: nextLabel, weight: 50 }])
  }

  function removeVariant(idx: number) {
    if (variants.length <= 2) return
    setVariants(v => v.filter((_, i) => i !== idx))
  }

  async function submit() {
    if (!publicationId) return
    if (!name.trim()) { alert('Name is required'); return }
    if (variants.some(v => !v.page_id)) { alert('Every variant needs a page selected'); return }
    const labels = new Set(variants.map(v => v.label.trim()))
    if (labels.size !== variants.length) { alert('Variant labels must be unique'); return }

    setBusy(true)
    try {
      const res = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          name,
          variants: variants.map((v, i) => ({
            page_id: v.page_id,
            label: v.label.trim(),
            weight: Number(v.weight) || 0,
            display_order: i,
          })),
          start_date: startDate ? new Date(startDate).toISOString() : null,
          end_date: endDate ? new Date(endDate).toISOString() : null,
          activate,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Create failed')
      }
      const data = await res.json()
      router.push(`/dashboard/${slug}/ab-tests/${data.test.id}`)
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const usablePages = pages.filter(p => p) // active list already from API

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0 max-w-3xl">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li><Link href={`/dashboard/${slug}/ab-tests`} className="text-gray-500 hover:text-gray-700">A/B Tests</Link></li>
            <li><span className="text-gray-500">/</span></li>
            <li><span className="text-gray-900 font-medium">New</span></li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4">New A/B Test</h1>

        {usablePages.length < 2 && (
          <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
            You need at least two subscribe pages to run a test.{' '}
            <Link href={`/dashboard/${slug}/subscribe-pages`} className="underline">Create pages →</Link>
          </div>
        )}

        <div className="bg-white border rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. Heading tone Oct 2026"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Variants</label>
              <button onClick={addVariant} className="text-sm text-blue-600 hover:underline">+ Add variant</button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={v.label}
                    onChange={(e) => setVariant(i, { label: e.target.value })}
                    className="col-span-2 border rounded px-2 py-1"
                    placeholder="A"
                  />
                  <select
                    value={v.page_id}
                    onChange={(e) => setVariant(i, { page_id: e.target.value })}
                    className="col-span-6 border rounded px-2 py-1"
                  >
                    <option value="">-- pick page --</option>
                    {usablePages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={v.weight}
                      onChange={(e) => setVariant(i, { weight: Number(e.target.value) })}
                      className="w-full border rounded px-2 py-1"
                    />
                    <span className="text-xs text-gray-500">wt</span>
                  </div>
                  <button
                    onClick={() => removeVariant(i)}
                    disabled={variants.length <= 2}
                    className="col-span-1 text-xs text-red-600 disabled:text-gray-300"
                    aria-label="Remove variant"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Traffic is split in proportion to each variant&apos;s weight. Equal weights = even split.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start date (optional)</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
            />
            Start the test immediately (otherwise saved as draft)
          </label>

          <div className="flex justify-end gap-3">
            <Link href={`/dashboard/${slug}/ab-tests`} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              Cancel
            </Link>
            <button
              onClick={submit}
              disabled={busy || usablePages.length < 2}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Create Test'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
