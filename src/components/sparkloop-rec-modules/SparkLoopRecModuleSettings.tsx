'use client'

import { useState, useEffect } from 'react'
import type { SparkLoopRecModule, SparkLoopRecSelectionMode } from '@/types/database'

interface SparkLoopRecModuleSettingsProps {
  module: SparkLoopRecModule
  onUpdate: (updates: Partial<SparkLoopRecModule>) => Promise<void>
  onDelete: () => void
}

const SELECTION_MODES: { value: SparkLoopRecSelectionMode; label: string; description: string }[] = [
  { value: 'score_based', label: 'Score Based', description: 'Top recommendations by CR x CPA x RCR score' },
  { value: 'random', label: 'Random', description: 'Randomly selected from eligible recommendations' },
  { value: 'sequential', label: 'Sequential', description: 'Cycles through recommendations in order' },
  { value: 'manual', label: 'Manual', description: 'Manually select recommendations per issue' },
]

export default function SparkLoopRecModuleSettings({
  module,
  onUpdate,
  onDelete
}: SparkLoopRecModuleSettingsProps) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setLocalModule(module)
    setDeleteConfirm(false)
    setDeleteText('')
  }, [module.id])

  const handleNameChange = async (newName: string) => {
    if (newName.trim() === module.name) return

    setSaving(true)
    setSaveStatus('saving')
    try {
      await onUpdate({ name: newName.trim() })
      setLocalModule(prev => ({ ...prev, name: newName.trim() }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to update name:', error)
      setSaveStatus('error')
      setLocalModule(prev => ({ ...prev, name: module.name }))
    } finally {
      setSaving(false)
    }
  }

  const handleSelectionModeChange = async (mode: SparkLoopRecSelectionMode) => {
    setSaving(true)
    try {
      await onUpdate({ selection_mode: mode })
      setLocalModule(prev => ({ ...prev, selection_mode: mode }))
    } catch (error) {
      console.error('Failed to update selection mode:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleRecsCountChange = async (count: number) => {
    const validCount = Math.max(1, Math.min(10, count))
    setSaving(true)
    try {
      await onUpdate({ recs_count: validCount })
      setLocalModule(prev => ({ ...prev, recs_count: validCount }))
    } catch (error) {
      console.error('Failed to update recs count:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleActiveToggle = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_active: !localModule.is_active })
      setLocalModule(prev => ({ ...prev, is_active: !prev.is_active }))
    } catch (error) {
      console.error('Failed to update active status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteText !== 'DELETE') return

    setSaving(true)
    try {
      await onDelete()
    } catch (error) {
      console.error('Failed to delete module:', error)
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteText('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with name and active toggle */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={localModule.name}
            onChange={(e) => setLocalModule(prev => ({ ...prev, name: e.target.value }))}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameChange(localModule.name)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-1 -ml-1"
          />
          {saveStatus === 'saving' && (
            <span className="text-xs text-orange-600 flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Failed to save
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {localModule.is_active ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={handleActiveToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localModule.is_active ? 'bg-orange-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localModule.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-orange-50 rounded-lg">
        <p className="text-sm text-orange-800">
          <strong>SparkLoop Recommendations</strong> are newsletter cards that promote partner newsletters. Subscribers can one-click subscribe, generating referral revenue. Mark recommendations as module-eligible in the SparkLoop admin tab.
        </p>
      </div>

      {/* Selection Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Selection Mode</label>
        <div className="space-y-2">
          {SELECTION_MODES.map(mode => (
            <label
              key={mode.value}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                localModule.selection_mode === mode.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="selection_mode"
                value={mode.value}
                checked={localModule.selection_mode === mode.value}
                onChange={() => handleSelectionModeChange(mode.value)}
                disabled={saving}
                className="mt-0.5 text-orange-600 focus:ring-orange-500"
              />
              <div>
                <div className="font-medium text-sm text-gray-900">{mode.label}</div>
                <div className="text-xs text-gray-500">{mode.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Recommendations Count */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recommendations Per Issue
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={10}
            value={localModule.recs_count}
            onChange={(e) => setLocalModule(prev => ({ ...prev, recs_count: parseInt(e.target.value) || 3 }))}
            onBlur={(e) => handleRecsCountChange(parseInt(e.target.value) || 3)}
            disabled={saving}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center"
          />
          <span className="text-sm text-gray-500">recommendation cards shown in the newsletter</span>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-lg overflow-hidden mt-8">
        <div className="p-4 bg-red-50">
          <h4 className="font-medium text-red-800">Danger Zone</h4>
          <p className="text-sm text-red-600 mt-1">
            Deleting this SparkLoop recommendations section will remove it from all future issues.
          </p>
        </div>

        {!deleteConfirm ? (
          <div className="p-4 bg-white">
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Section
            </button>
          </div>
        ) : (
          <div className="p-4 bg-white space-y-3">
            <p className="text-sm text-gray-700">
              Type <strong>DELETE</strong> to confirm deletion of &quot;{localModule.name}&quot;
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeleteText('')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteText !== 'DELETE' || saving}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  deleteText === 'DELETE' && !saving
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Saving...
        </div>
      )}
    </div>
  )
}
