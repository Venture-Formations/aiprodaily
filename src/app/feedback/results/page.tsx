'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface VoteBreakdown {
  value: number
  label: string
  count: number
  percentage: number
}

interface FeedbackResults {
  total_votes: number
  breakdown: VoteBreakdown[]
  user_vote?: { value: number; label: string }
  average_score: number
}

interface ResultsPageConfig {
  confirmation_message?: string
  first_vote_message?: string
  feedback_label?: string
  feedback_placeholder?: string
  feedback_success_message?: string
  continue_button_text?: string
  submit_button_text?: string
  footer_text?: string
}

const defaultConfig: ResultsPageConfig = {
  confirmation_message: 'Your response has been recorded.',
  first_vote_message: "You're the first to vote!",
  feedback_label: 'Additional feedback',
  feedback_placeholder: 'Elaborate on your answer, or just leave some general feedback...',
  feedback_success_message: 'Thank you for your feedback!',
  continue_button_text: 'Continue',
  submit_button_text: 'Submit Feedback',
  footer_text: 'You can close this window at any time.'
}

function generateStars(count: number): string {
  return '★'.repeat(count)
}

function FeedbackResultsContent() {
  const searchParams = useSearchParams()
  const moduleId = searchParams.get('module_id')
  const issueId = searchParams.get('issue_id')
  const email = searchParams.get('email')
  const voteId = searchParams.get('vote_id')
  const userVoteValue = searchParams.get('vote')

  const [results, setResults] = useState<FeedbackResults | null>(null)
  const [config, setConfig] = useState<ResultsPageConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!moduleId || !issueId) {
      setError('Missing required parameters')
      setLoading(false)
      return
    }

    fetch(`/api/feedback/${moduleId}/results?issue_id=${issueId}&email=${encodeURIComponent(email || '')}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResults(data.results)
          // Merge API config with defaults
          if (data.config) {
            setConfig({ ...defaultConfig, ...data.config })
          }
        } else {
          setError(data.error || 'Failed to load results')
        }
      })
      .catch(err => {
        console.error('Error fetching results:', err)
        setError('Failed to load results')
      })
      .finally(() => setLoading(false))
  }, [moduleId, issueId, email])

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/feedback/${moduleId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote_id: voteId,
          issue_id: issueId,
          email: email,
          comment_text: feedback
        })
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Failed to submit feedback')
      }
    } catch (err) {
      console.error('Error submitting feedback:', err)
      setError('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const userVote = results?.user_vote || (userVoteValue ? {
    value: parseInt(userVoteValue),
    label: results?.breakdown.find(b => b.value === parseInt(userVoteValue))?.label || ''
  } : undefined)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4">
      <div className="max-w-lg w-full bg-white shadow-lg rounded-lg p-8">
        {/* Success Checkmark */}
        <div className="text-center mb-6">
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-lg text-gray-700">{config.confirmation_message}</p>
        </div>

        {/* Results Card */}
        {results && results.breakdown.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="font-bold text-lg text-gray-900 mb-4">
              {results.total_votes === 1 ? config.first_vote_message : `Results (${results.total_votes} votes)`}
            </h2>

            <div className="space-y-3">
              {results.breakdown.map((option) => {
                const isUserVote = userVote && userVote.value === option.value
                return (
                  <div
                    key={option.value}
                    className={`rounded-lg p-3 ${isUserVote ? 'bg-gray-100 ring-2 ring-cyan-500' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-lg">{generateStars(option.value)}</span>
                        <span className="font-medium text-gray-900">{option.label}</span>
                        {isUserVote && (
                          <svg className="h-5 w-5 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">({option.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                        style={{ width: `${option.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Additional Feedback Form */}
        {!submitted ? (
          <div className="mb-6">
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
              {config.feedback_label}
            </label>
            <textarea
              id="feedback"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
              placeholder={config.feedback_placeholder}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={submitting}
            />
          </div>
        ) : (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{config.feedback_success_message}</span>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={submitted ? () => window.close() : handleSubmitFeedback}
          disabled={submitting}
          className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : submitted ? 'Close' : feedback.trim() ? config.submit_button_text : config.continue_button_text}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          {config.footer_text}
        </p>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
    </div>
  )
}

export default function FeedbackResultsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FeedbackResultsContent />
    </Suspense>
  )
}
