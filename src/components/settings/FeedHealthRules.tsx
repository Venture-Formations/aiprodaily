'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

interface FeedHealthRule {
  id: string
  feed_id: string
  feed_name: string
  rule_type: string
  description: string
  threshold_value: number
  threshold_unit: string
  baseline_value: number | null
  is_active: boolean
  created_by: string
  last_triggered: string | null
  last_evaluated: string | null
  created_at: string
}

const RULE_TYPE_LABELS: Record<string, string> = {
  freshness: 'Freshness',
  quality: 'Quality',
  extraction: 'Extraction',
  volume: 'Volume',
}

const RULE_TYPE_COLORS: Record<string, string> = {
  freshness: 'bg-blue-100 text-blue-800',
  quality: 'bg-purple-100 text-purple-800',
  extraction: 'bg-orange-100 text-orange-800',
  volume: 'bg-green-100 text-green-800',
}

export default function FeedHealthRules() {
  const pathname = usePathname()
  const slug = pathname?.split('/')[2] || ''

  const [rules, setRules] = useState<FeedHealthRule[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const fetchRules = useCallback(async (pubId: string) => {
    try {
      const res = await fetch(`/api/feed-health-rules?publication_id=${pubId}`)
      if (!res.ok) throw new Error('Failed to fetch rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error('Failed to fetch feed health rules:', error)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        const pubRes = await fetch(`/api/newsletters?slug=${slug}`)
        if (!pubRes.ok) return
        const pubData = await pubRes.json()
        const pubId = pubData.newsletters?.[0]?.id
        if (!pubId) return
        await fetchRules(pubId)
      } catch (error) {
        console.error('Failed to initialize:', error)
      } finally {
        setLoading(false)
      }
    }
    if (slug) init()
  }, [slug, fetchRules])

  const toggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/feed-health-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, is_active: !currentActive }),
      })
      if (!res.ok) throw new Error('Failed to update rule')
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentActive } : r))
      showMessage('Rule updated', 'success')
    } catch (error) {
      showMessage('Failed to update rule', 'error')
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return
    try {
      const res = await fetch('/api/feed-health-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId }),
      })
      if (!res.ok) throw new Error('Failed to delete rule')
      setRules(prev => prev.filter(r => r.id !== ruleId))
      showMessage('Rule deleted', 'success')
    } catch (error) {
      showMessage('Failed to delete rule', 'error')
    }
  }

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Loading feed health rules...</div>
  }

  const activeRules = rules.filter(r => r.is_active)
  const aiRules = rules.filter(r => r.created_by === 'ai')
  const manualRules = rules.filter(r => r.created_by === 'manual')

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded text-sm ${messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold">{rules.length}</div>
          <div className="text-sm text-gray-500">Total Rules</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">{activeRules.length}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">{aiRules.length}</div>
          <div className="text-sm text-gray-500">AI-Generated</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-600">{manualRules.length}</div>
          <div className="text-sm text-gray-500">Manual</div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center text-gray-500">
          <p className="text-lg mb-2">No feed health rules yet</p>
          <p className="text-sm">Rules will be auto-generated by the daily feed health analysis cron, or you can create manual rules.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Triggered</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id} className={!rule.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.feed_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${RULE_TYPE_COLORS[rule.rule_type] || 'bg-gray-100 text-gray-800'}`}>
                      {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{rule.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {rule.threshold_value} {rule.threshold_unit}
                    {rule.baseline_value != null && (
                      <span className="text-gray-400 ml-1">(baseline: {rule.baseline_value})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded ${rule.created_by === 'ai' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {rule.created_by === 'ai' ? 'AI' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {rule.last_triggered
                      ? new Date(rule.last_triggered).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`px-2 py-1 rounded text-xs ${rule.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                    >
                      {rule.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
