'use client'

import { useState } from 'react'
import type { NewsletterCampaign } from '@/types/database'

interface DeleteCampaignModalProps {
  campaign: NewsletterCampaign
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteCampaignModal({
  campaign,
  isOpen,
  onClose,
  onConfirm
}: DeleteCampaignModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/delete`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete campaign')
      }

      onConfirm()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete campaign')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('')
      onClose()
    }
  }

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-red-600 mb-2">
            Delete Campaign
          </h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Date:</strong> {formatDate(campaign.date)}</p>
            <p><strong>Status:</strong> {campaign.status}</p>
            {campaign.subject_line && (
              <p><strong>Subject:</strong> {campaign.subject_line}</p>
            )}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Warning: This action cannot be undone
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>The campaign and all its settings</li>
                  <li>All articles associated with this campaign</li>
                  <li>All event associations for this campaign</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <span className="font-bold text-red-600">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Type DELETE here"
            disabled={isDeleting}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}