'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    // Check if we're in staging environment
    const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
    const isStaging = hostname.includes('staging') ||
                      hostname.includes('git-staging') ||
                      hostname.includes('localhost')

    if (isStaging) {
      // In staging, go directly to dashboard
      router.replace('/dashboard')
      return
    }

    if (session) {
      // Authenticated users go to dashboard
      router.replace('/dashboard')
    } else {
      // Unauthenticated users go to sign in
      router.replace('/auth/signin')
    }
  }, [session, status, router])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
