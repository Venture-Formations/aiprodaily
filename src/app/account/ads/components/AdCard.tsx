'use client'

import Link from 'next/link'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  Calendar,
  ExternalLink,
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react'
import type { Advertisement } from '@/types/database'

interface AdCardProps {
  ad: Advertisement
}

const statusConfig = {
  pending_payment: {
    label: 'Awaiting Payment',
    color: 'bg-amber-100 text-amber-800',
    icon: Clock,
  },
  pending_review: {
    label: 'Submitted',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
  },
  in_progress: {
    label: 'Being Created',
    color: 'bg-purple-100 text-purple-800',
    icon: Loader2,
  },
  awaiting_approval: {
    label: 'Ready for Approval',
    color: 'bg-cyan-100 text-cyan-800',
    icon: AlertCircle,
  },
  approved: {
    label: 'Scheduled',
    color: 'bg-emerald-100 text-emerald-800',
    icon: Calendar,
  },
  active: {
    label: 'Running',
    color: 'bg-green-100 text-green-800 animate-pulse',
    icon: Send,
  },
  completed: {
    label: 'Sent',
    color: 'bg-gray-100 text-gray-800',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
}

export function AdCard({ ad }: AdCardProps) {
  const status = statusConfig[ad.status as keyof typeof statusConfig] || statusConfig.pending_review
  const StatusIcon = status.icon

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Ad Image Preview */}
        <div className="flex-shrink-0">
          {ad.image_url ? (
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-24 h-20 rounded-lg object-cover border border-gray-200"
            />
          ) : (
            <div className="w-24 h-20 rounded-lg bg-gradient-to-br from-[#1c293d] to-[#2d3f5a] flex items-center justify-center">
              <span className="text-white/60 text-xs">No image</span>
            </div>
          )}
        </div>

        {/* Ad Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">{ad.company_name || ad.title}</h3>
              <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">{ad.title}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>

          {/* Date & Type */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(ad.preferred_start_date || ad.actual_start_date)}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
              {ad.ad_type === 'main_sponsor' ? 'Main Sponsor' : ad.ad_type || 'Newsletter'}
            </span>
          </div>

          {/* Rejection reason */}
          {ad.status === 'rejected' && ad.rejection_reason && (
            <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
              <strong>Reason:</strong> {ad.rejection_reason}
            </div>
          )}

          {/* Stats for completed ads */}
          {ad.status === 'completed' && (
            <div className="flex items-center gap-6 mt-3 text-sm">
              <span className="text-gray-500">
                Impressions: <span className="font-medium text-gray-900">—</span>
              </span>
              <span className="text-gray-500">
                Clicks: <span className="font-medium text-gray-900">—</span>
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {ad.status === 'awaiting_approval' && (
            <Link
              href={`/account/ads/${ad.id}`}
              className="px-4 py-2 bg-[#06b6d4] text-white rounded-lg text-sm font-medium hover:bg-[#06b6d4]/90 transition-colors"
            >
              Review & Approve
            </Link>
          )}
          <Link
            href={`/account/ads/${ad.id}`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  )
}

