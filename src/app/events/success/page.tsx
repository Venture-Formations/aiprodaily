'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sessionId = searchParams.get('session_id')
  const isFree = searchParams.get('free') === 'true'

  useEffect(() => {
    // Clear the cart
    sessionStorage.removeItem('eventCart')

    if (!isFree && sessionId) {
      // Verify the payment with backend (optional)
      verifyPayment(sessionId)
    } else {
      setLoading(false)
    }
  }, [sessionId, isFree])

  const verifyPayment = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/events/verify-payment?session_id=${sessionId}`)
      if (!response.ok) {
        throw new Error('Failed to verify payment')
      }
      setLoading(false)
    } catch (error) {
      console.error('Payment verification failed:', error)
      setError('Payment verification failed. Please contact support.')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Verifying your submission...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isFree ? 'Event Submitted!' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isFree
              ? 'Your event has been submitted for review. You will receive an email confirmation shortly.'
              : 'Your payment has been processed and your events have been submitted. You will receive an email confirmation shortly.'
            }
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Your events are now active in our system</li>
              <li>• Our team will review your submission</li>
              <li>• You will receive a confirmation email</li>
              <li>• We may contact you if any changes are needed</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              href="/events/view"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
            >
              View All Events
            </Link>
            <Link
              href="/events/submit"
              className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-md font-medium"
            >
              Submit Another Event
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
