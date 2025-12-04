'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface ApproveButtonProps {
  adId: string
}

export function ApproveButton({ adId }: ApproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this ad? It will be scheduled for the selected date.')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/account/ads/${adId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        // Refresh the page to show updated status
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to approve ad')
      }
    } catch (error) {
      alert('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#06b6d4] text-white rounded-lg font-medium hover:bg-[#06b6d4]/90 transition-colors disabled:opacity-50"
    >
      <CheckCircle className="w-5 h-5" />
      {isLoading ? 'Approving...' : 'Approve Ad'}
    </button>
  )
}

