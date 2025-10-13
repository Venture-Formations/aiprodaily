'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isStaging, setIsStaging] = useState(false)

  useEffect(() => {
    // Check if we're in staging environment
    const hostname = window.location.hostname
    const staging = hostname.includes('staging') ||
                    hostname.includes('git-staging') ||
                    hostname.includes('localhost')
    setIsStaging(staging)

    if (staging) {
      console.log('[Layout] Staging environment detected - auth bypass active')
      return
    }

    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  // In staging, skip loading state and show content immediately
  if (isStaging) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/dashboard" className="flex items-center">
                  <h1 className="text-xl font-bold text-brand-primary">
                    St. Cloud Scoop
                  </h1>
                </Link>
                <nav className="hidden md:flex space-x-8">
                  <Link
                    href="/dashboard"
                    className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/campaigns"
                    className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                  >
                    Campaigns
                  </Link>
                  <Link
                    href="/dashboard/analytics"
                    className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                  >
                    Analytics
                  </Link>
                  <Link
                    href="/dashboard/databases"
                    className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                  >
                    Databases
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                  >
                    Settings
                  </Link>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Staging Test User
                </span>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-xs font-medium">
                  STAGING MODE
                </span>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center">
                <h1 className="text-xl font-bold text-brand-primary">
                  St. Cloud Scoop
                </h1>
              </Link>
              <nav className="hidden md:flex space-x-8">
                <Link
                  href="/dashboard"
                  className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/campaigns"
                  className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                >
                  Campaigns
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                >
                  Analytics
                </Link>
                <Link
                  href="/dashboard/databases"
                  className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                >
                  Databases
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}