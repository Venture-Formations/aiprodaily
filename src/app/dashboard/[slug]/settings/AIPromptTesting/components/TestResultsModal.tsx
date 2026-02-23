'use client'

import { useState } from 'react'

interface TestResult {
  timestamp: Date
  provider: 'openai' | 'claude'
  model: string
  promptType: string
  response: string | { raw?: string; [key: string]: any }
  tokensUsed?: number
  duration: number
  apiRequest?: any
  isMultiple?: boolean
  responses?: string[]
  fullApiResponse?: any
  fullApiResponses?: any[]
  sourcePosts?: Array<{
    id: string
    title: string
    description: string | null
    content: string | null
    source_url: string | null
    publication_date: string | null
  }>
  sourceIssues?: Array<{
    id: string
    date: string
    sent_at: string
  }>
  isCustomFreeform?: boolean
}

interface TestResultsModalProps {
  currentResponse: TestResult
  onClose: () => void
}

export default function TestResultsModal({ currentResponse, onClose }: TestResultsModalProps) {
  const [showPromptDetails, setShowPromptDetails] = useState(false)
  const [showSourcePosts, setShowSourcePosts] = useState(false)
  const [showFullApiResponses, setShowFullApiResponses] = useState(false)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
            <p className="text-sm text-gray-600 mt-1">
              {currentResponse.provider.toUpperCase()} &bull; {currentResponse.model} &bull; {currentResponse.duration}ms
              {currentResponse.tokensUsed && ` \u2022 ${currentResponse.tokensUsed} tokens`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* API Call Details (Collapsible) */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPromptDetails(!showPromptDetails)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            >
              <span className="font-medium text-gray-900">
                {showPromptDetails ? '\u25BC' : '\u25B6'} API Call Details
              </span>
              <span className="text-sm text-gray-500">
                {showPromptDetails ? 'Click to collapse' : 'Click to expand'}
              </span>
            </button>
            {showPromptDetails && (
              <div className="p-4 bg-white">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Exact API Request Sent to {currentResponse.provider.toUpperCase()}:
                </h4>
                <pre className="bg-gray-50 rounded p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                  {currentResponse.apiRequest
                    ? JSON.stringify(currentResponse.apiRequest, null, 2)
                    : 'No API request details available'}
                </pre>
              </div>
            )}
          </div>

          {/* Source Issues Section (for Custom/Freeform multiple tests) */}
          {currentResponse.isMultiple && currentResponse.isCustomFreeform && currentResponse.sourceIssues && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowSourcePosts(!showSourcePosts)}
                className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 flex items-center justify-between text-left"
              >
                <span className="font-medium text-purple-900">
                  {showSourcePosts ? '\u25BC' : '\u25B6'} Source Issues Used ({currentResponse.sourceIssues.length} issues)
                </span>
                <span className="text-sm text-purple-600">
                  {showSourcePosts ? 'Click to collapse' : 'Click to expand'}
                </span>
              </button>
              {showSourcePosts && (
                <div className="p-4 bg-white">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {currentResponse.sourceIssues.map((issue, index) => (
                      <div key={issue.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">Issue {index + 1}</span>
                          <span className="text-gray-500 ml-2">({issue.date})</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          Sent: {new Date(issue.sent_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source Posts Section (for multiple article tests) */}
          {currentResponse.isMultiple && !currentResponse.isCustomFreeform && currentResponse.sourcePosts && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowSourcePosts(!showSourcePosts)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900">
                  {showSourcePosts ? '\u25BC' : '\u25B6'} Source Articles Used ({currentResponse.sourcePosts.length} posts)
                </span>
                <span className="text-sm text-gray-500">
                  {showSourcePosts ? 'Click to collapse' : 'Click to expand'}
                </span>
              </button>
              {showSourcePosts && (
                <div className="p-4 bg-white">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {currentResponse.sourcePosts.map((post, index) => (
                      <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">Article {index + 1}</h5>
                          {post.source_url && (
                            <a
                              href={post.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Source
                            </a>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Title:</p>
                            <p className="text-sm text-gray-900">{post.title}</p>
                          </div>
                          {post.description && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Description:</p>
                              <p className="text-sm text-gray-700">{post.description}</p>
                            </div>
                          )}
                          {post.content && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Full Content:</p>
                              <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                                <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                  {post.content || 'No content'}
                                </p>
                              </div>
                            </div>
                          )}
                          {post.publication_date && (
                            <p className="text-xs text-gray-500">
                              Published: {new Date(post.publication_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Response Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <h4 className="font-medium text-blue-900">
                {currentResponse.isMultiple
                  ? currentResponse.isCustomFreeform
                    ? `AI Responses (${currentResponse.sourceIssues?.length || 10} Issues)`
                    : `AI Responses (${currentResponse.sourcePosts?.length || 10} Articles)`
                  : 'AI Response'}
              </h4>
            </div>
            <div className="p-4 bg-white">
              {currentResponse.isMultiple && currentResponse.responses ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {currentResponse.responses.map((response, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">
                          {currentResponse.isCustomFreeform ? 'Issue' : 'Article'} {index + 1}
                          {currentResponse.isCustomFreeform && currentResponse.sourceIssues?.[index] && (
                            <span className="text-gray-500 font-normal ml-2">
                              ({currentResponse.sourceIssues[index].date})
                            </span>
                          )}
                        </h5>
                      </div>
                      <div className="bg-gray-50 rounded p-3 whitespace-pre-wrap text-sm">
                        {typeof response === 'object'
                          ? JSON.stringify(response, null, 2)
                          : response}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap text-sm font-mono">
                  {typeof currentResponse.response === 'string'
                    ? currentResponse.response
                    : (currentResponse.response?.raw
                      ? currentResponse.response.raw
                      : JSON.stringify(currentResponse.response, null, 2))}
                </div>
              )}
            </div>
          </div>

          {/* Full API Response Section (for single test) */}
          {!currentResponse.isMultiple && currentResponse.fullApiResponse && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFullApiResponses(!showFullApiResponses)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900">
                  {showFullApiResponses ? '\u25BC' : '\u25B6'} Full API Response
                </span>
                <span className="text-sm text-gray-500">
                  {showFullApiResponses ? 'Click to collapse' : 'Click to expand'}
                </span>
              </button>
              {showFullApiResponses && (
                <div className="p-4 bg-white">
                  <p className="text-xs text-gray-600 mb-3">
                    Full API response object returned from {currentResponse.provider.toUpperCase()}.
                    This shows the complete response structure even if parsing failed.
                  </p>
                  <div className="bg-gray-50 rounded p-3 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs font-mono overflow-x-auto">
                      {JSON.stringify(currentResponse.fullApiResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full API Responses Section (for multiple article tests) */}
          {currentResponse.isMultiple && currentResponse.fullApiResponses && currentResponse.fullApiResponses.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFullApiResponses(!showFullApiResponses)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900">
                  {showFullApiResponses ? '\u25BC' : '\u25B6'} Full API Responses ({currentResponse.fullApiResponses.length} responses)
                </span>
                <span className="text-sm text-gray-500">
                  {showFullApiResponses ? 'Click to collapse' : 'Click to expand'}
                </span>
              </button>
              {showFullApiResponses && (
                <div className="p-4 bg-white">
                  <p className="text-xs text-gray-600 mb-3">
                    Full API response objects returned from {currentResponse.provider.toUpperCase()}.
                    This shows the complete response structure even if parsing failed.
                  </p>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {currentResponse.fullApiResponses.map((fullResponse, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">Article {index + 1} - Full API Response</h5>
                        </div>
                        <div className="bg-gray-50 rounded p-3 max-h-64 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-xs font-mono overflow-x-auto">
                            {fullResponse
                              ? JSON.stringify(fullResponse, null, 2)
                              : 'No response available (error occurred)'}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Provider:</span>
              <span className="ml-2 font-medium">{currentResponse.provider.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-gray-600">Model:</span>
              <span className="ml-2 font-medium">{currentResponse.model}</span>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <span className="ml-2 font-medium">{currentResponse.duration}ms</span>
            </div>
            {currentResponse.tokensUsed && (
              <div>
                <span className="text-gray-600">Tokens:</span>
                <span className="ml-2 font-medium">{currentResponse.tokensUsed}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Prompt Type:</span>
              <span className="ml-2 font-medium capitalize">{currentResponse.promptType.replace('-', ' ')}</span>
            </div>
            <div>
              <span className="text-gray-600">Timestamp:</span>
              <span className="ml-2 font-medium">{currentResponse.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
