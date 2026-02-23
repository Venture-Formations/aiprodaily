'use client'

import { useState, useEffect } from 'react'

export default function PollSection({ issue }: { issue: any }) {
  const [activePoll, setActivePoll] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [responseCount, setResponseCount] = useState(0)
  const [isHistoricalPoll, setIsHistoricalPoll] = useState(false)

  useEffect(() => {
    const fetchPollData = async () => {
      try {
        // For sent issues, show the poll that was actually included (from poll_snapshot)
        if (issue.status === 'sent' && issue.poll_snapshot) {
          setActivePoll(issue.poll_snapshot)
          setIsHistoricalPoll(true)
          // Fetch response count for this specific poll
          if (issue.poll_id) {
            const responsesResponse = await fetch(`/api/polls/${issue.poll_id}/responses?publication_id=${issue.publication_id}`)
            if (responsesResponse.ok) {
              const responsesData = await responsesResponse.json()
              setResponseCount(responsesData.responses?.length || 0)
            }
          }
        } else {
          // For non-sent issues, show the current active poll
          const response = await fetch(`/api/polls/active?publication_id=${issue.publication_id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.poll) {
              setActivePoll(data.poll)
              setIsHistoricalPoll(false)
              // Fetch response count for this poll
              const responsesResponse = await fetch(`/api/polls/${data.poll.id}/responses?publication_id=${issue.publication_id}`)
              if (responsesResponse.ok) {
                const responsesData = await responsesResponse.json()
                setResponseCount(responsesData.responses?.length || 0)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch poll data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (issue?.publication_id) {
      fetchPollData()
    } else {
      setLoading(false)
    }
  }, [issue?.publication_id, issue?.status, issue?.poll_snapshot, issue?.poll_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading poll data...</span>
      </div>
    )
  }

  if (!activePoll) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          {issue.status === 'sent'
            ? 'No poll was included in this issue.'
            : 'No active poll found. Create and activate a poll in the Poll Management section.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              {activePoll.title}
            </h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              isHistoricalPoll
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {isHistoricalPoll ? 'Sent with Issue' : 'Active'}
            </span>
          </div>
          <p className="text-gray-700 text-base mb-4">{activePoll.question}</p>
        </div>

        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-gray-700">Options:</h4>
          {activePoll.options && activePoll.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-gray-200">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-gray-900">{option}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Responses:</span>
            <span className="font-semibold text-gray-900">{responseCount}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {isHistoricalPoll
              ? 'This poll was included when the newsletter was sent.'
              : 'This poll will appear in the newsletter and track subscriber responses.'}
          </div>
        </div>
      </div>
    </div>
  )
}
