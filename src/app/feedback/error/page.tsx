'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const errorMessages: { [key: string]: string } = {
    'missing-params': 'Required information is missing from your request.',
    'invalid-date': 'The campaign date is invalid.',
    'invalid-email': 'The email address is invalid.',
    'invalid-choice': 'The section choice is invalid.',
    'server-error': 'A server error occurred while processing your feedback.'
  }

  const errorMessage = reason ? errorMessages[reason] || 'An unknown error occurred.' : 'An error occurred.'

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-lg text-gray-600 mb-4">
            Something went wrong
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>
          <p className="text-sm text-gray-500">
            Please try clicking the feedback button in the newsletter again, or contact us if the problem persists.
          </p>
        </div>

        <div className="border-t pt-6">
          <a
            href="https://st-cloud-scoop.vercel.app"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Visit St. Cloud Scoop
          </a>
        </div>

        <div className="mt-6 text-xs text-gray-400">
          St. Cloud Scoop • Your Local News Source
        </div>
      </div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
