'use client'

import Image from 'next/image'
import type { Tool } from './types'
import { statusColors, planLabels, isValidImageUrl } from './types'

interface ToolCardProps {
  tool: Tool
  actionLoading: string | null
  rejectingId: string | null
  rejectReason: string
  onApprove: (toolId: string) => void
  onReject: (toolId: string) => void
  onDelete: (toolId: string) => void
  onEdit: (tool: Tool) => void
  onStartReject: (toolId: string) => void
  onCancelReject: () => void
  onRejectReasonChange: (reason: string) => void
}

export default function ToolCard({
  tool,
  actionLoading,
  rejectingId,
  rejectReason,
  onApprove,
  onReject,
  onDelete,
  onEdit,
  onStartReject,
  onCancelReject,
  onRejectReasonChange,
}: ToolCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex gap-4">
        {/* Images - Logo (1:1) and Listing (16:9) */}
        <div className="flex-shrink-0 flex gap-2">
          {/* Logo */}
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Logo</p>
            {isValidImageUrl(tool.logo_image_url) ? (
              <Image
                src={tool.logo_image_url!}
                alt={`${tool.tool_name} logo`}
                width={64}
                height={64}
                className="rounded-lg object-cover"
                style={{ width: '64px', height: '64px' }}
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-xl text-gray-400">
                  {tool.tool_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {/* Listing Image */}
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Listing</p>
            {isValidImageUrl(tool.tool_image_url) ? (
              <Image
                src={tool.tool_image_url!}
                alt={tool.tool_name}
                width={114}
                height={64}
                className="rounded-lg object-cover"
                style={{ width: '114px', height: '64px' }}
              />
            ) : (
              <div className="w-[114px] h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-xs text-gray-400">No image</span>
              </div>
            )}
          </div>
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tool.tool_name}</h3>
              {tool.tagline && (
                <p className="text-sm text-gray-600 mt-0.5">{tool.tagline}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[tool.status]}`}>
                {tool.status}
              </span>
              {tool.is_sponsored && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {planLabels[tool.plan]}
                </span>
              )}
              {tool.is_featured && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  Featured
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-700 mt-2 line-clamp-2">{tool.description}</p>

          <div className="flex flex-wrap gap-2 mt-2">
            {tool.categories.map((cat) => (
              <span key={cat.id} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                {cat.name}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {tool.website_url}
            </a>
            <span>|</span>
            <span>Submitted by: {tool.submitter_name || tool.submitter_email}</span>
            <span>|</span>
            <span>{new Date(tool.created_at).toLocaleDateString()}</span>
          </div>

          {tool.rejection_reason && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
              <strong>Rejection reason:</strong> {tool.rejection_reason}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        {/* Approve button for pending and rejected tools */}
        {(tool.status === 'pending' || tool.status === 'rejected') && (
          <button
            onClick={() => onApprove(tool.id)}
            disabled={actionLoading === tool.id}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {actionLoading === tool.id ? 'Processing...' : 'Approve'}
          </button>
        )}

        {/* Reject button only for pending tools */}
        {tool.status === 'pending' && (
          <>
            {rejectingId === tool.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => onRejectReasonChange(e.target.value)}
                  placeholder="Rejection reason..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => onReject(tool.id)}
                  disabled={actionLoading === tool.id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={onCancelReject}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => onStartReject(tool.id)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Reject
              </button>
            )}
          </>
        )}

        <button
          onClick={() => onEdit(tool)}
          disabled={actionLoading === tool.id}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Edit
        </button>

        <button
          onClick={() => onDelete(tool.id)}
          disabled={actionLoading === tool.id}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
