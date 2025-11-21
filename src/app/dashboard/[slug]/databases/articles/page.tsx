'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ArticlesDatabaseRedirect() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  useEffect(() => {
    // Redirect to Analytics tab with Articles tab selected
    router.replace(`/dashboard/${slug}/analytics?tab=articles`)
  }, [slug, router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Analytics...</p>
      </div>
    </div>
  )
}
