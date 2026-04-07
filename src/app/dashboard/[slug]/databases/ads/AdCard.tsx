'use client'

import type { AdWithRelations } from './types'

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending_payment: 'bg-yellow-100 text-yellow-800',
    pending_review: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800'
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}

const proseClasses = "prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_ol]:list-none [&_ol]:pl-0 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"

function AnalyticsLink({ adId }: { adId: string }) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/ads/${adId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline truncate"
      >
        View Analytics
      </a>
      <button
        onClick={() => {
          const url = `${window.location.origin}/ads/${adId}`
          navigator.clipboard.writeText(url)
          alert('Analytics URL copied!')
        }}
        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
        title="Copy analytics URL"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      </button>
    </div>
  )
}

interface ReviewAdCardProps {
  ad: AdWithRelations
  onPreview: (ad: AdWithRelations) => void
  onEdit: (ad: AdWithRelations) => void
  onApprove: (adId: string) => void
  onReject: (adId: string) => void
}

export function ReviewAdCard({ ad, onPreview, onEdit, onApprove, onReject }: ReviewAdCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold">{ad.title}</h3>
            {getStatusBadge(ad.status)}
          </div>
          <p className="text-sm text-gray-600">
            Submitted {new Date(ad.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPreview(ad)}
            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
          >
            Preview
          </button>
          <a
            href={`/ads/${ad.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
          >
            Analytics
          </a>
          <button
            onClick={() => onApprove(ad.id)}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(ad.id)}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
          >
            Reject
          </button>
          <button
            onClick={() => onEdit(ad)}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div
            className={proseClasses}
            dangerouslySetInnerHTML={{ __html: ad.body }}
          />
        </div>
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="sm:w-[284px] w-full h-40 object-cover rounded border border-gray-200 sm:flex-shrink-0"
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t text-sm">
        <div>
          <span className="font-medium">Company:</span>
          <p className="text-gray-600 truncate" title={ad.advertiser?.company_name || ad.company_name || ''}>
            {ad.advertiser?.company_name || ad.company_name || '\u2014'}
          </p>
        </div>
        <div>
          <span className="font-medium">URL:</span>
          <p className="text-gray-600 truncate" title={ad.button_url}>{ad.button_url}</p>
        </div>
        <div>
          <span className="font-medium">Has Image:</span>
          <p className="text-gray-600">{ad.image_url ? 'Yes' : 'No'}</p>
        </div>
        <div>
          <span className="font-medium">Analytics:</span>
          <AnalyticsLink adId={ad.id} />
        </div>
      </div>
    </div>
  )
}

interface InactiveAdCardProps {
  ad: AdWithRelations
  onPreview: (ad: AdWithRelations) => void
  onEdit: (ad: AdWithRelations) => void
  onActivate: (adId: string) => void
  onDelete: (adId: string) => void
}

export function InactiveAdCard({ ad, onPreview, onEdit, onActivate, onDelete }: InactiveAdCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold">{ad.title}</h3>
            {getStatusBadge(ad.status)}
          </div>
          <p className="text-sm text-gray-600">
            {ad.times_used} times used
          </p>
          {ad.status === 'rejected' && ad.rejection_reason && (
            <p className="text-sm text-red-600 mt-2">
              <strong>Rejection reason:</strong> {ad.rejection_reason}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPreview(ad)}
            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
          >
            Preview
          </button>
          <a
            href={`/ads/${ad.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
          >
            Analytics
          </a>
          <button
            onClick={() => onActivate(ad.id)}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
          >
            Activate
          </button>
          <button
            onClick={() => onEdit(ad)}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(ad.id)}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div
            className={proseClasses}
            dangerouslySetInnerHTML={{ __html: ad.body }}
          />
        </div>
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="sm:w-[284px] w-full h-40 object-cover rounded border border-gray-200 sm:flex-shrink-0"
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t text-sm">
        <div>
          <span className="font-medium">Company:</span>
          <p className="text-gray-600 truncate" title={ad.advertiser?.company_name || ad.company_name || ''}>
            {ad.advertiser?.company_name || ad.company_name || '\u2014'}
          </p>
        </div>
        <div>
          <span className="font-medium">URL:</span>
          <p className="text-gray-600 truncate" title={ad.button_url}>{ad.button_url}</p>
        </div>
        <div>
          <span className="font-medium">Last Used:</span>
          <p className="text-gray-600">
            {ad.last_used_date ? new Date(ad.last_used_date).toLocaleDateString() : 'Never'}
          </p>
        </div>
        <div>
          <span className="font-medium">Analytics:</span>
          <AnalyticsLink adId={ad.id} />
        </div>
      </div>
    </div>
  )
}
