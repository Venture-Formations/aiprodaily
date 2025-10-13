'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ThankYouContent() {
  const searchParams = useSearchParams()
  const choice = searchParams.get('choice')

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-lg text-gray-600 mb-4">
            Your feedback has been recorded.
          </p>
          {choice && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">You selected:</p>
              <p className="text-xl font-semibold text-blue-600">{choice}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            We appreciate you taking the time to help us improve the St. Cloud Scoop newsletter.
            Your preference has been saved to your subscriber profile.
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

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ThankYouContent />
    </Suspense>
  )
}
