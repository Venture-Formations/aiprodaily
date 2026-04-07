'use client'

import type { NewsArticle } from '@/types/database'
import { formatDateString } from './useManualArticles'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    used: 'bg-blue-100 text-blue-800'
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.toUpperCase()}
    </span>
  )
}

interface ArticleActionsProps {
  article: NewsArticle
  websiteDomain: string
  onEdit: (article: NewsArticle) => void
  onStatusChange: (articleId: string, newStatus: 'draft' | 'published') => void
  onDelete: (articleId: string) => void
}

function ArticleActions({ article, websiteDomain, onEdit, onStatusChange, onDelete }: ArticleActionsProps) {
  const viewUrl = websiteDomain
    ? `https://${websiteDomain}/news/${article.slug}`
    : `/news/${article.slug}`

  if (article.status === 'draft') {
    return (
      <>
        <button onClick={() => onEdit(article)} className="text-blue-600 hover:text-blue-900">
          Edit
        </button>
        <button onClick={() => onStatusChange(article.id, 'published')} className="text-green-600 hover:text-green-900">
          Publish
        </button>
        <button onClick={() => onDelete(article.id)} className="text-red-600 hover:text-red-900">
          Delete
        </button>
      </>
    )
  }

  if (article.status === 'published') {
    return (
      <>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900">
          View
        </a>
        <button onClick={() => onEdit(article)} className="text-blue-600 hover:text-blue-900">
          Edit
        </button>
        <button onClick={() => onStatusChange(article.id, 'draft')} className="text-yellow-600 hover:text-yellow-900">
          Unpublish
        </button>
        <button onClick={() => onDelete(article.id)} className="text-red-600 hover:text-red-900">
          Delete
        </button>
      </>
    )
  }

  if (article.status === 'used') {
    return (
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">
        View
      </a>
    )
  }

  return null
}

interface ArticleTableProps {
  articles: NewsArticle[]
  websiteDomain: string
  onEdit: (article: NewsArticle) => void
  onStatusChange: (articleId: string, newStatus: 'draft' | 'published') => void
  onDelete: (articleId: string) => void
}

export default function ArticleTable({
  articles,
  websiteDomain,
  onEdit,
  onStatusChange,
  onDelete,
}: ArticleTableProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Article
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Section
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {articles.map((article) => (
            <tr key={article.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center">
                  {article.image_url && (
                    <img
                      src={article.image_url}
                      alt=""
                      className="w-16 h-9 object-cover rounded mr-3"
                    />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {article.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {websiteDomain ? `${websiteDomain}/news/${article.slug}` : `/news/${article.slug}`}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {article.section_type === 'primary_articles' ? 'Primary' : 'Secondary'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {article.category?.name || '-'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {formatDateString(article.publish_date)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={article.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <ArticleActions
                    article={article}
                    websiteDomain={websiteDomain}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
