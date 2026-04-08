'use client'

import type { Column, ScoredPost } from './types'
import { formatDate, getColumnWidthClass } from './utils'
import ExpandedRow from './ExpandedRow'

interface PostsTableProps {
  filteredPosts: ScoredPost[]
  enabledColumns: Column[]
  expandedRow: string | null
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  onSort: (columnKey: string) => void
  onToggleRow: (id: string) => void
}

function renderCellContent(post: ScoredPost, columnKey: string) {
  switch (columnKey) {
    case 'ingestDate':
    case 'publicationDate':
      return formatDate(post[columnKey as keyof ScoredPost] as string)
    case 'feedType': {
      const getColorClass = (type: string) => {
        if (type === 'Primary') return 'bg-blue-100 text-blue-800'
        if (type === 'Secondary') return 'bg-purple-100 text-purple-800'
        return 'bg-green-100 text-green-800'
      }
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full max-w-full truncate ${getColorClass(post.feedType)}`}
          title={post.feedType}
        >
          {post.feedType}
        </span>
      )
    }
    case 'totalScore':
    case 'criteria1Score':
    case 'criteria2Score':
    case 'criteria3Score':
    case 'criteria4Score':
    case 'criteria5Score': {
      const score = post[columnKey as keyof ScoredPost] as number | null
      return score !== null ? score.toFixed(1) : 'N/A'
    }
    case 'finalPosition': {
      const num = post.finalPosition
      return num !== null ? num.toLocaleString() : '-'
    }
    case 'companyName':
      return post.companyName || '-'
    case 'originalTitle':
      return post.originalTitle || ''
    case 'sourceUrl':
    case 'imageUrl': {
      const urlVal = post[columnKey as keyof ScoredPost] as string
      return urlVal ? (
        <a
          href={urlVal}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-primary hover:text-blue-700"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </a>
      ) : 'N/A'
    }
    default:
      return String(post[columnKey as keyof ScoredPost] || '')
  }
}

export default function PostsTable({
  filteredPosts,
  enabledColumns,
  expandedRow,
  sortColumn,
  sortDirection,
  onSort,
  onToggleRow,
}: PostsTableProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {enabledColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={`px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${getColumnWidthClass(col.width)}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{col.label}</span>
                    <span className="text-gray-400 flex-shrink-0">
                      {sortColumn === col.key ? (
                        sortDirection === 'desc' ? '\u25BC' : '\u25B2'
                      ) : null}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">

              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPosts.length === 0 ? (
              <tr>
                <td colSpan={enabledColumns.length + 1} className="px-2 py-8 text-center text-gray-500">
                  No scored posts found
                </td>
              </tr>
            ) : (
              filteredPosts.map((post) => (
                <>
                  <tr key={post.id} className="hover:bg-gray-50">
                    {enabledColumns.map(col => (
                      <td key={col.key} className={`px-2 py-2 text-sm text-gray-900 break-words ${getColumnWidthClass(col.width)}`}>
                        {renderCellContent(post, col.key)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-sm font-medium whitespace-nowrap w-16">
                      <button
                        onClick={() => onToggleRow(post.id)}
                        className="text-brand-primary hover:text-blue-700"
                      >
                        {expandedRow === post.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>

                  {expandedRow === post.id && (
                    <ExpandedRow
                      key={`${post.id}-expanded`}
                      post={post}
                      colSpan={enabledColumns.length + 1}
                    />
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
