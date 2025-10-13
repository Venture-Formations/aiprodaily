'use client'

interface CsvUploadResult {
  created: number
  skipped: number
  errors: string[]
}

interface CsvUploadSummaryProps {
  result: CsvUploadResult
  onClose: () => void
  uploadType: string // e.g., "Dining Deals", "VRBO Listings", "Events"
}

export default function CsvUploadSummary({ result, onClose, uploadType }: CsvUploadSummaryProps) {
  const totalProcessed = result.created + result.skipped + result.errors.length
  const hasErrors = result.errors.length > 0

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border max-w-2xl shadow-lg rounded-md bg-white">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            {uploadType} CSV Upload Complete
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload finished. Here's a summary of the results.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{result.created}</div>
            <div className="text-sm text-green-700">Created</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
            <div className="text-sm text-yellow-700">Skipped</div>
            <div className="text-xs text-yellow-600 mt-1">(Already exists)</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
            <div className="text-sm text-red-700">Errors</div>
          </div>
        </div>

        {/* Total Processed */}
        <div className="bg-gray-50 rounded-lg p-3 mb-6 text-center">
          <div className="text-sm text-gray-600">
            <strong>Total rows processed:</strong> {totalProcessed}
          </div>
        </div>

        {/* Error Details */}
        {hasErrors && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Error Details:</h4>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-48 overflow-y-auto">
              <ul className="list-disc list-inside space-y-1">
                {result.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Success Message */}
        {!hasErrors && result.created > 0 && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Upload successful!</strong> All {result.created} records were processed without errors.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Changes Message */}
        {!hasErrors && result.created === 0 && result.skipped > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>No new records added.</strong> All {result.skipped} records already exist in the database.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-brand-primary hover:bg-brand-dark text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}