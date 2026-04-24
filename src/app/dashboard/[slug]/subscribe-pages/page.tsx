'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'

interface SubscribePage {
  id: string
  publication_id: string
  name: string
  content: Record<string, string | undefined>
  is_archived: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

interface Newsletter {
  id: string
  slug: string
  name: string
}

const CONTENT_FIELDS: Array<{ key: string; label: string; multiline?: boolean; placeholder?: string }> = [
  { key: 'heading', label: 'Heading', multiline: true, placeholder: 'Master AI Tools, Prompts & News **in Just 3 Minutes a Day**' },
  { key: 'subheading', label: 'Subheading', multiline: true, placeholder: 'Join 10,000+ professionals…' },
  { key: 'tagline', label: 'Tagline', placeholder: 'FREE FOREVER' },
  { key: 'logo_url', label: 'Logo URL (override)', placeholder: '' },
  { key: 'cta_text', label: 'CTA button text (override)', placeholder: '' },
]

export default function SubscribePagesDashboardPage() {
  const { slug } = useParams() as { slug: string }
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [pages, setPages] = useState<SubscribePage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SubscribePage | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ name: string; content: Record<string, string>; is_default: boolean }>({
    name: '',
    content: {},
    is_default: false,
  })
  const [busy, setBusy] = useState(false)

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
        console.error('[SubscribePages] newsletter load failed', err)
        setNewsletter(null)
        setLoading(false)
      }
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!publicationId) return
    fetchPages()
  }, [publicationId])

  async function fetchPages() {
    if (!publicationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/subscribe-pages?publication_id=${publicationId}&include_archived=true`)
      const json = await res.json()
      setPages(json.pages || [])
    } catch (err) {
      console.error('[SubscribePages] fetchPages failed', err)
      setPages([])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    // If no page is default yet, suggest making the first one default
    const suggestDefault = !pages.some(p => p.is_default && !p.is_archived)
    setForm({ name: '', content: {}, is_default: suggestDefault })
    setCreating(true)
  }

  function openEdit(p: SubscribePage) {
    setCreating(false)
    setEditing(p)
    setForm({
      name: p.name,
      content: Object.fromEntries(
        Object.entries(p.content || {}).map(([k, v]) => [k, v ?? ''])
      ) as Record<string, string>,
      is_default: p.is_default,
    })
  }

  function closeForm() {
    setEditing(null)
    setCreating(false)
    setForm({ name: '', content: {}, is_default: false })
  }

  async function submit() {
    if (!publicationId) return
    if (!form.name.trim()) { alert('Name is required'); return }
    setBusy(true)
    try {
      // Strip empty strings so defaults fall through to publication_settings
      const cleanContent: Record<string, string> = {}
      for (const [k, v] of Object.entries(form.content)) {
        const trimmed = (v || '').trim()
        if (trimmed) cleanContent[k] = trimmed
      }

      if (creating) {
        const res = await fetch('/api/subscribe-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: form.name,
            content: cleanContent,
            is_default: form.is_default,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Create failed')
        }
      } else if (editing) {
        const res = await fetch(`/api/subscribe-pages/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: form.name,
            content: cleanContent,
            is_default: form.is_default,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Update failed')
        }
      }
      closeForm()
      await fetchPages()
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function setAsDefault(p: SubscribePage) {
    if (!publicationId) return
    const res = await fetch(`/api/subscribe-pages/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publication_id: publicationId, is_default: true }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Failed to set default')
      return
    }
    await fetchPages()
  }

  async function archive(p: SubscribePage) {
    if (!publicationId) return
    if (p.is_default) {
      alert('Mark another page as default before archiving this one.')
      return
    }
    if (!confirm(`Archive "${p.name}"? Existing tests referencing it keep working.`)) return
    const res = await fetch(`/api/subscribe-pages/${p.id}?publication_id=${publicationId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Archive failed')
      return
    }
    await fetchPages()
  }

  const visiblePages = useMemo(() => pages.filter(p => !p.is_archived), [pages])
  const hasDefault = useMemo(() => visiblePages.some(p => p.is_default), [visiblePages])

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li><Link href={`/dashboard/${slug}`} className="text-gray-500 hover:text-gray-700">Dashboard</Link></li>
                <li><span className="text-gray-500">/</span></li>
                <li><span className="text-gray-900 font-medium">Subscribe Pages</span></li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Subscribe Pages</h1>
            <p className="text-gray-600">
              The <strong>default</strong> page is what visitors see on /subscribe when no A/B test is running.
              A/B tests pick 2+ pages to compare.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/${slug}/ab-tests`}
              className="text-sm text-brand-primary hover:underline"
            >
              View A/B Tests →
            </Link>
            <button
              onClick={openCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              New Page
            </button>
          </div>
        </div>

        {!hasDefault && visiblePages.length > 0 && (
          <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
            No page is currently marked as <strong>default</strong>. /subscribe will fall back to your publication_settings values.
            Set a page as default to manage content from here instead.
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : visiblePages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg">
            No pages yet. Create one to manage your /subscribe content and start A/B testing.
          </div>
        ) : (
          <ul className="divide-y border rounded-lg bg-white">
            {visiblePages.map(p => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.is_default && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-xl mt-0.5">
                    {p.content?.heading || <span className="italic">(uses publication default heading)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!p.is_default && (
                    <button
                      onClick={() => setAsDefault(p)}
                      className="text-sm text-green-700 hover:underline"
                    >
                      Set as Default
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} className="text-sm text-blue-600 hover:underline">Edit</button>
                  <button
                    onClick={() => archive(p)}
                    className={`text-sm ${p.is_default ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:underline'}`}
                    disabled={p.is_default}
                    title={p.is_default ? 'Default page cannot be archived' : ''}
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(creating || editing) && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {creating ? 'New Subscribe Page' : `Edit: ${editing?.name}`}
              </h2>

              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 mb-4"
                placeholder="e.g. Bold heading / Control / v3"
              />

              <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Use as the default /subscribe page (replaces any current default)
              </label>

              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Leave a field blank to fall through to the publication default.
                </p>
                {CONTENT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        value={form.content[f.key] || ''}
                        onChange={(e) => setForm({ ...form, content: { ...form.content, [f.key]: e.target.value } })}
                        className="w-full border rounded px-3 py-2"
                        rows={2}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <input
                        type="text"
                        value={form.content[f.key] || ''}
                        onChange={(e) => setForm({ ...form, content: { ...form.content, [f.key]: e.target.value } })}
                        className="w-full border rounded px-3 py-2"
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}

                {/* Phone number collection */}
                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.content.collect_phone === 'true'}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          content: { ...form.content, collect_phone: e.target.checked ? 'true' : 'false' },
                        })
                      }
                    />
                    Collect phone number (optional field on the form)
                  </label>
                  {form.content.collect_phone === 'true' && (
                    <div className="mt-3 space-y-3 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone field label</label>
                        <input
                          type="text"
                          value={form.content.phone_label || ''}
                          onChange={(e) =>
                            setForm({ ...form, content: { ...form.content, phone_label: e.target.value } })
                          }
                          className="w-full border rounded px-3 py-2"
                          placeholder="Phone (optional)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone field placeholder</label>
                        <input
                          type="text"
                          value={form.content.phone_placeholder || ''}
                          onChange={(e) =>
                            setForm({ ...form, content: { ...form.content, phone_placeholder: e.target.value } })
                          }
                          className="w-full border rounded px-3 py-2"
                          placeholder="Your phone number"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeForm}
                  disabled={busy}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : creating ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
