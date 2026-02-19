'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function IssuePageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Issue Page Error]', error.message, error.stack)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Issue page failed to load
        </h2>
        <p className="text-gray-600 mb-2">
          {error.message}
        </p>
        <p className="text-xs text-gray-400 mb-6 font-mono break-all">
          {error.stack?.split('\n')[1]?.trim()}
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Try Again
          </button>
          <Link
            href="/dashboard/issues"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
          >
            Back to Issues
          </Link>
        </div>
      </div>
    </div>
  )
}
