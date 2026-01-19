'use client'

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

type Preference = 'daily' | 'weekly' | 'unsubscribe'

const PREFERENCE_OPTIONS: { value: Preference; label: string }[] = [
  {
    value: 'daily',
    label: 'Receive Daily Emails'
  },
  {
    value: 'weekly',
    label: 'Receive Weekly Email'
  },
  {
    value: 'unsubscribe',
    label: 'Unsubscribe from All Emails'
  },
]

export function PreferenceForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(initialEmail)
  const [preference, setPreference] = useState<Preference>('daily')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Update email if URL param changes
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail)
    }
  }, [initialEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          preference,
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || 'Your preferences have been updated.')
      } else {
        setError(data.message || data.error || 'Failed to update preferences. Please try again.')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // If success, show success message
  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-green-50 p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-green-800">Success!</h3>
          <p className="mt-2 text-green-700">{success}</p>
          {preference !== 'unsubscribe' && (
            <a
              href="/"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-500 underline"
            >
              Return to homepage
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 text-left mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="you@example.com"
            className="w-full rounded-lg border-0 bg-white px-4 py-3 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          />
        </div>

        {/* Preference Radio Buttons */}
        <div>
          <label className="block text-sm font-medium text-slate-700 text-left mb-3">
            Email Preferences <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            {PREFERENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center p-4 rounded-lg cursor-pointer transition-all ${
                  preference === option.value
                    ? 'bg-blue-50 ring-2 ring-blue-600'
                    : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="preference"
                  value={option.value}
                  checked={preference === option.value}
                  onChange={(e) => setPreference(e.target.value as Preference)}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-600"
                />
                <span className={`ml-3 text-sm font-medium ${
                  preference === option.value ? 'text-blue-900' : 'text-slate-900'
                }`}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full rounded-full bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Updating...' : 'Update Preferences'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}
    </div>
  )
}
