'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DangerZoneProps {
  publicationId: string
  slug: string
}

export default function DangerZone({ publicationId, slug }: DangerZoneProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [confirmSlug, setConfirmSlug] = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState('')

  const slugMatches = confirmSlug === slug

  const handleDeactivate = async () => {
    if (!slugMatches) return
    setDeactivating(true)
    setError('')

    try {
      const res = await fetch(`/api/publications/${publicationId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmSlug }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to deactivate publication')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setDeactivating(false)
    }
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
        <h3 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-4">
          Irreversible and destructive actions for this publication.
        </p>

        <div className="border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Deactivate this publication</h4>
              <p className="text-sm text-gray-500 mt-1">
                Hide this publication from the dashboard. All data (issues, articles, settings) will be preserved.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="ml-4 px-4 py-2 border border-red-600 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 whitespace-nowrap"
            >
              Deactivate Publication
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !deactivating && setShowModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Deactivate publication
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will hide the publication from the dashboard. All data is preserved and can be
              reactivated by an administrator.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                {error}
              </div>
            )}

            <p className="text-sm text-gray-700 mb-2">
              To confirm, type the publication slug: <strong>{slug}</strong>
            </p>
            <input
              type="text"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 mb-4"
              placeholder={slug}
              autoFocus
            />

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowModal(false); setConfirmSlug(''); setError('') }}
                disabled={deactivating}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={!slugMatches || deactivating}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium"
              >
                {deactivating ? 'Deactivating...' : 'Deactivate Publication'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
