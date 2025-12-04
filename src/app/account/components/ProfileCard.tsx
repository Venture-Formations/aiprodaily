'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Edit, 
  ExternalLink, 
  Star, 
  Eye, 
  MousePointer,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'
import type { DirectoryTool, DirectoryCategory } from '@/types/database'
import { EditProfileModal } from './EditProfileModal'

interface ProfileCardProps {
  tool: DirectoryTool & { categories: DirectoryCategory[] }
}

const statusConfig = {
  pending: {
    label: 'Pending Review',
    color: 'bg-amber-100 text-amber-800',
    icon: Clock,
    description: 'Your listing is being reviewed. This usually takes 1-2 business days.'
  },
  approved: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle,
    description: 'Your listing is live in the directory.'
  },
  edited: {
    label: 'Active (Changes Pending)',
    color: 'bg-blue-100 text-blue-800',
    icon: AlertCircle,
    description: 'Your changes are live. Our team will review them shortly.'
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    description: 'Your listing was not approved.'
  }
}

export function ProfileCard({ tool }: ProfileCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const status = statusConfig[tool.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = status.icon

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with gradient based on sponsored status */}
        <div className={`h-32 relative ${
          tool.is_sponsored 
            ? 'bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6]' 
            : 'bg-gradient-to-r from-[#1c293d] to-[#2d3f5a]'
        }`}>
          {/* Tool Image if available */}
          {tool.tool_image_url && (
            <Image
              src={tool.tool_image_url}
              alt={tool.tool_name}
              fill
              className="object-cover opacity-30"
            />
          )}
          
          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </span>
          </div>

          {/* Sponsored Badge */}
          {tool.is_sponsored && (
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white text-[#1c293d]">
                <Star className="w-4 h-4 fill-current text-amber-500" />
                Sponsored
              </span>
            </div>
          )}

          {/* Logo */}
          <div className="absolute -bottom-10 left-6">
            {tool.logo_image_url ? (
              <Image
                src={tool.logo_image_url}
                alt={`${tool.tool_name} logo`}
                width={80}
                height={80}
                className="rounded-xl border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl border-4 border-white shadow-lg bg-gradient-to-br from-[#06b6d4] to-[#14b8a6] flex items-center justify-center">
                <span className="text-white text-3xl font-bold">
                  {tool.tool_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pt-14 px-6 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{tool.tool_name}</h2>
              {tool.tagline && (
                <p className="text-gray-600 mt-1">{tool.tagline}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1c293d] text-white rounded-lg hover:bg-[#1c293d]/90 transition-colors text-sm font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
              <Link
                href={`/tools/${tool.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#06b6d4] text-white rounded-lg hover:bg-[#06b6d4]/90 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                View Page
              </Link>
              <a
                href={tool.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Site
              </a>
            </div>
          </div>

          {/* Status Message */}
          {tool.status !== 'approved' && (
            <div className={`mt-4 p-4 rounded-lg ${
              tool.status === 'rejected' ? 'bg-red-50' : 
              tool.status === 'edited' ? 'bg-blue-50' : 'bg-amber-50'
            }`}>
              <p className={`text-sm ${
                tool.status === 'rejected' ? 'text-red-700' : 
                tool.status === 'edited' ? 'text-blue-700' : 'text-amber-700'
              }`}>
                {status.description}
                {tool.status === 'rejected' && tool.rejection_reason && (
                  <span className="block mt-1 font-medium">
                    Reason: {tool.rejection_reason}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Description */}
          <p className="mt-4 text-gray-700 leading-relaxed">
            {tool.description}
          </p>

          {/* Categories */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tool.categories.map((category) => (
              <span
                key={category.id}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {category.name}
              </span>
            ))}
          </div>

          {/* Stats Row */}
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Views</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {tool.view_count?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
                <MousePointer className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Clicks</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {tool.click_count?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
                <Star className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Plan</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 capitalize">
                {tool.is_sponsored ? 'Sponsored' : 'Free'}
              </p>
            </div>
          </div>

          {/* Upgrade CTA for non-sponsored */}
          {!tool.is_sponsored && tool.status === 'approved' && (
            <div className="mt-6 p-4 bg-gradient-to-r from-[#a855f7]/10 via-[#06b6d4]/10 to-[#14b8a6]/10 rounded-xl border border-[#06b6d4]/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Upgrade to Sponsored</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Get a sponsored badge, appear at the top of search results, and stand out with a highlighted listing.
                  </p>
                </div>
                <Link
                  href="/account/upgrade"
                  className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Upgrade Now
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <EditProfileModal 
        tool={tool}
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
      />
    </>
  )
}

