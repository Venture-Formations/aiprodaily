'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'

interface RssSource {
  author: string
  post_count: number
  excluded: boolean
}

export default function RssSourcesPage() {
  const [sources, setSources] = useState<RssSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rss-sources')
      if (!response.ok) {
        throw new Error('Failed to fetch RSS sources')
      }
      const data = await response.json()
      setSources(data.sources || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleExclusion = async (author: string, currentlyExcluded: boolean) => {
    try {
      const response = await fetch('/api/rss-sources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author,
          excluded: !currentlyExcluded
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error response:', errorData)
        throw new Error(errorData.error || 'Failed to update source exclusion')
      }

      // Refresh the list
      await fetchSources()
    } catch (err) {
      console.error('Toggle exclusion error:', err)
      alert(err instanceof Error ? err.message : 'Failed to update source')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={fetchSources}
            className="text-brand-primary hover:text-blue-700"
          >
            Try Again
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            RSS Sources Management
          </h1>
          <p className="text-sm text-gray-600">
            Block images from specific RSS sources. Posts from blocked sources will still be processed, but their images won't be used. This typically lowers their AI interest score, making them lower priority.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source/Author
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posts Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No RSS sources found
                  </td>
                </tr>
              ) : (
                sources.map((source) => (
                  <tr key={source.author} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {source.author || '(No Author)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {source.post_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {source.excluded ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Images Blocked
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Images Allowed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => toggleExclusion(source.author, source.excluded)}
                        className={`${
                          source.excluded
                            ? 'text-green-600 hover:text-green-900'
                            : 'text-red-600 hover:text-red-900'
                        }`}
                      >
                        {source.excluded ? 'Unblock Images' : 'Block Images'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sources.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <p>
              Total Sources: {sources.length} |
              Images Allowed: {sources.filter(s => !s.excluded).length} |
              Images Blocked: {sources.filter(s => s.excluded).length}
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
