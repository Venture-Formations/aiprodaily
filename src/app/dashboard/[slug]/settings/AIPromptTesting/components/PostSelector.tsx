'use client'

import type { RSSPost, PromptType } from '../types'

interface PostSelectorProps {
  postSource: 'sent' | 'pool' | 'scored'
  setPostSource: (s: 'sent' | 'pool' | 'scored') => void
  promptType: PromptType
  status: string
  loadingPosts: boolean
  recentPosts: RSSPost[]
  selectedPostId: string
  setSelectedPostId: (id: string) => void
  selectedPost: RSSPost | null
}

export default function PostSelector({
  postSource,
  setPostSource,
  promptType,
  status,
  loadingPosts,
  recentPosts,
  selectedPostId,
  setSelectedPostId,
  selectedPost,
}: PostSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Sample RSS Post
      </label>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setPostSource('sent')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            postSource === 'sent'
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
          }`}
        >
          From Sent Issues
        </button>
        <button
          type="button"
          onClick={() => setPostSource('pool')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            postSource === 'pool'
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
          }`}
        >
          From RSS Pool
        </button>
        <button
          type="button"
          onClick={() => setPostSource('scored')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            postSource === 'scored'
              ? 'bg-purple-100 text-purple-700 border-purple-300'
              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
          }`}
        >
          From Scored Posts
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {postSource === 'pool'
          ? 'Recently ingested posts from RSS feeds (last 7 days)'
          : postSource === 'scored'
            ? 'Posts scored by AI criteria, ordered by total score (last 7 days)'
            : promptType === 'custom'
              ? 'Posts from sent newsletters (last 7 days) - Optional for freeform testing'
              : 'Posts from sent newsletters (last 7 days)'}
      </p>
      {status === 'loading' ? (
        <p className="text-gray-500 text-sm">Authenticating...</p>
      ) : loadingPosts ? (
        <p className="text-gray-500 text-sm">Loading posts...</p>
      ) : recentPosts.length === 0 ? (
        <div className="text-gray-500 text-sm bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="font-medium text-yellow-800">No posts found</p>
          <p className="text-xs mt-1">
            {postSource === 'pool'
              ? 'No RSS posts ingested in the last 7 days.'
              : postSource === 'scored'
                ? 'No scored posts found in the last 7 days.'
                : 'No newsletters have been sent in the last 7 days.'}
          </p>
        </div>
      ) : (
        <>
          <select
            value={selectedPostId}
            onChange={(e) => setSelectedPostId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
            aria-label="Sample RSS Post"
          >
            {recentPosts.map(post => (
              <option key={post.id} value={post.id}>
                {post.total_score != null
                  ? `[Score: ${Math.round(post.total_score)}] `
                  : post.used_in_issue_date
                    ? `[${new Date(post.used_in_issue_date).toLocaleDateString()}] `
                    : ''}
                {post.title.substring(0, 70)}...
              </option>
            ))}
          </select>
          {selectedPost && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
              <p className="font-medium mb-1">{selectedPost.title}</p>
              {selectedPost.total_score != null && (
                <p className="text-xs text-purple-600 mb-1">
                  Total Score: {Math.round(selectedPost.total_score)}
                </p>
              )}
              {selectedPost.used_in_issue_date && (
                <p className="text-xs text-green-600 mb-1">
                  Used in issue: {new Date(selectedPost.used_in_issue_date).toLocaleDateString()}
                  {selectedPost.generated_headline && ` \u2022 Generated: "${selectedPost.generated_headline.substring(0, 40)}..."`}
                </p>
              )}
              <p className="text-xs">{selectedPost.description?.substring(0, 150)}...</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
