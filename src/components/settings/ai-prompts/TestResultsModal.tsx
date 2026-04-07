'use client'

interface TestResultsModalProps {
  isOpen: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  results: any
}

export function TestResultsModal({ isOpen, onClose, loading, error, results }: TestResultsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Prompt Test Results</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <span className="ml-4 text-gray-600">Testing prompt...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <strong>Error:</strong> {error}
            </div>
          ) : results ? (
            <div className="space-y-6">
              {/* RSS Post Info */}
              {results.rss_post_used && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Test Data:</h4>
                  <p className="text-sm text-blue-800">
                    <strong>Post:</strong> {results.rss_post_used.title}
                  </p>
                  {results.rss_post_used.source_url && (
                    <p className="text-sm text-blue-800 mt-1">
                      <strong>Source:</strong>{' '}
                      <a href={results.rss_post_used.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {results.rss_post_used.source_url}
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Parsed Expected Outputs */}
              {results.parsedOutputs && Object.keys(results.parsedOutputs).length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3">Expected Outputs:</h4>
                  <div className="space-y-2">
                    {Object.entries(results.parsedOutputs).map(([fieldName, fieldData]: [string, any]) => (
                      <div key={fieldName} className="bg-white border border-gray-200 rounded p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">{fieldName}:</p>
                            {fieldData.error ? (
                              <p className="text-sm font-bold text-red-600">ERROR</p>
                            ) : (
                              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                {typeof fieldData.value === 'object'
                                  ? JSON.stringify(fieldData.value, null, 2)
                                  : fieldData.value}
                              </p>
                            )}
                          </div>
                          <span className={`ml-3 px-2 py-1 text-xs font-medium rounded ${
                            fieldData.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {fieldData.error ? 'Failed' : 'Parsed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Results */}
              {Object.entries(results.results || {}).map(([key, result]: [string, any]) => (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>

                  {result.success ? (
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Parsed Content:</h5>
                        {typeof result.response === 'string' ? (
                          <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                            {result.response}
                          </div>
                        ) : result.response?.raw ? (
                          <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                            {result.response.raw}
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded p-4">
                            <pre className="whitespace-pre-wrap text-sm">
                              {JSON.stringify(result.response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {result.fullResponse && (
                        <details className="border border-gray-300 rounded-lg">
                          <summary className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-t-lg font-medium text-sm text-gray-700">
                            Full API Response (Click to expand)
                          </summary>
                          <div className="bg-white p-4 rounded-b-lg">
                            <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                              {JSON.stringify(result.fullResponse, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}

                      {result.character_count && (
                        <p className="text-sm text-gray-600">Character count: {result.character_count}</p>
                      )}
                      {result.prompt_length && (
                        <p className="text-sm text-gray-600">Prompt length: {result.prompt_length} characters</p>
                      )}
                      {result.test_posts_count && (
                        <p className="text-sm font-medium text-blue-600">
                          Test articles: {result.test_posts_count} articles analyzed
                        </p>
                      )}
                      {result.expected_duplicates && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>Expected duplicates:</strong> {result.expected_duplicates}
                        </p>
                      )}
                      {result.test_articles_count && (
                        <p className="text-sm font-medium text-blue-600">
                          Test articles: {result.test_articles_count} articles analyzed
                        </p>
                      )}
                      {result.prompt_source && (
                        <p className="text-sm text-gray-500">Prompt source: {result.prompt_source}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
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
