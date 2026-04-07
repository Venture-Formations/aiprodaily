'use client'

import type { ScoredPost } from './types'
import { formatDate } from './utils'

interface ExpandedRowProps {
  post: ScoredPost
  colSpan: number
}

const CRITERIA_COLORS = [
  'border-blue-400',
  'border-green-400',
  'border-yellow-400',
  'border-red-400',
  'border-purple-400',
]

function CriteriaBlock({ index, post }: { index: number; post: ScoredPost }) {
  const n = index + 1
  const enabled = post[`criteria${n}Enabled` as keyof ScoredPost] as boolean
  if (!enabled) return null

  const name = post[`criteria${n}Name` as keyof ScoredPost] as string
  const score = post[`criteria${n}Score` as keyof ScoredPost] as number | null
  const weight = post[`criteria${n}Weight` as keyof ScoredPost] as number
  const reasoning = post[`criteria${n}Reasoning` as keyof ScoredPost] as string

  return (
    <div className={`border-l-4 ${CRITERIA_COLORS[index]} pl-3`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-medium text-gray-700">{name}</span>
        <span className="text-gray-900 whitespace-nowrap">
          Score: {score}/10 (Weight: {weight})
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-1 break-words">{reasoning}</p>
    </div>
  )
}

export default function ExpandedRow({ post, colSpan }: ExpandedRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-4 bg-gray-50">
        <div className="space-y-4 max-w-4xl overflow-hidden">
          {/* Original Content Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Original RSS Content</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Publication Date:</span>
                <span className="ml-2 text-gray-600">{formatDate(post.publicationDate)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Author:</span>
                <span className="ml-2 text-gray-600">{post.author || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Feed Name:</span>
                <span className="ml-2 text-gray-600">{post.feedName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Source URL:</span>
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-brand-primary hover:text-blue-700"
                >
                  View Original
                </a>
              </div>
            </div>
            <div className="mt-2 overflow-hidden">
              <span className="font-medium text-gray-700">Description:</span>
              <p className="mt-1 text-gray-600 break-words [word-break:break-word]">{post.originalDescription}</p>
            </div>
            <div className="mt-2 overflow-hidden">
              <span className="font-medium text-gray-700">Full Article Text:</span>
              <p className="mt-1 text-gray-600 max-h-40 overflow-y-auto break-words whitespace-pre-wrap [word-break:break-word]">
                {post.originalFullText || 'Not available'}
              </p>
            </div>
            {post.imageUrl && (
              <div className="mt-2">
                <span className="font-medium text-gray-700">Image:</span>
                <a
                  href={post.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-brand-primary hover:text-blue-700"
                >
                  View Image
                </a>
              </div>
            )}
          </div>

          {/* Scoring Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Scoring Details</h3>
            <div className="mb-2 text-sm">
              <span className="font-medium text-gray-700">Total Score:</span>
              <span className="ml-2 text-gray-900 font-semibold">{post.totalScore?.toFixed(1) ?? 'N/A'}</span>
              {post.finalPosition !== null && (
                <span className="ml-4 text-green-700 font-medium">Used in issue (Position {post.finalPosition})</span>
              )}
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map(i => (
                <CriteriaBlock key={i} index={i} post={post} />
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
