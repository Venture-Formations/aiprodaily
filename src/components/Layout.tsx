'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import MobileMenu from './MobileMenu'
import type { Newsletter } from '@/types/database'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isStaging, setIsStaging] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [newsletterSlug, setNewsletterSlug] = useState<string | null>(null)

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

  // Extract newsletter slug from pathname
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1] !== 'campaigns' && match[1] !== 'analytics' && match[1] !== 'databases' && match[1] !== 'settings' && match[1] !== 'logs') {
        setNewsletterSlug(match[1])
      } else {
        setNewsletterSlug(null)
      }
    }
  }, [pathname])

  // Fetch newsletter data when slug changes
  useEffect(() => {
    if (newsletterSlug) {
      fetchNewsletter(newsletterSlug)
    } else {
      setNewsletter(null)
    }
  }, [newsletterSlug])

  const fetchNewsletter = async (slug: string) => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) return
      const data = await response.json()
      const found = data.newsletters?.find((n: Newsletter) => n.slug === slug)
      setNewsletter(found || null)
    } catch (error) {
      console.error('Error fetching newsletter:', error)
      setNewsletter(null)
    }
  }

  // In staging, skip loading state and show content immediately
  if (isStaging) {
    const dashboardUrl = newsletterSlug ? `/dashboard/${newsletterSlug}` : '/dashboard'
    const campaignsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/issues` : '/dashboard/issues'
    const analyticsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/analytics` : '/dashboard/analytics'
    const databasesUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/databases` : '/dashboard/databases'
    const settingsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/settings` : '/dashboard/settings'

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/dashboard" className="flex items-center">
                  <h1 className="text-xl font-bold text-brand-primary">
                    {newsletter?.name || 'AI Pro Daily'}
                  </h1>
                </Link>
                {newsletterSlug && (
                  <nav className="hidden md:flex space-x-8">
                    <Link href={dashboardUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                      Dashboard
                    </Link>
                    <Link href={campaignsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                      Issues
                    </Link>
                    <Link href={analyticsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                      Analytics
                    </Link>
                    <Link href={databasesUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                      Databases
                    </Link>
                    <Link href={settingsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                      Settings
                    </Link>
                  </nav>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="hidden sm:inline text-sm text-gray-700">
                  Staging Test User
                </span>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-xs font-medium">
                  STAGING MODE
                </span>
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  aria-label="Open menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userDisplay="Staging Test User"
          dashboardUrl={dashboardUrl}
          campaignsUrl={campaignsUrl}
          analyticsUrl={analyticsUrl}
          databasesUrl={databasesUrl}
          settingsUrl={settingsUrl}
        />
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

  const dashboardUrl = newsletterSlug ? `/dashboard/${newsletterSlug}` : '/dashboard'
  const campaignsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/issues` : '/dashboard/issues'
  const analyticsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/analytics` : '/dashboard/analytics'
  const databasesUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/databases` : '/dashboard/databases'
  const settingsUrl = newsletterSlug ? `/dashboard/${newsletterSlug}/settings` : '/dashboard/settings'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center">
                <h1 className="text-xl font-bold text-brand-primary">
                  {newsletter?.name || 'AI Pro Daily'}
                </h1>
              </Link>
              {newsletterSlug && (
                <nav className="hidden md:flex space-x-8">
                  <Link href={dashboardUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                    Dashboard
                  </Link>
                  <Link href={campaignsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                    Issues
                  </Link>
                  <Link href={analyticsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                    Analytics
                  </Link>
                  <Link href={databasesUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                    Databases
                  </Link>
                  <Link href={settingsUrl} className="text-gray-900 hover:text-brand-primary px-3 py-2 text-sm font-medium">
                    Settings
                  </Link>
                </nav>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline text-sm text-gray-700">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="hidden md:inline-flex bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm font-medium"
              >
                Sign Out
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                aria-label="Open menu"
                aria-expanded={isMobileMenuOpen}
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSignOut={() => signOut()}
        userDisplay={session.user?.name || session.user?.email || ''}
        dashboardUrl={dashboardUrl}
        campaignsUrl={campaignsUrl}
        analyticsUrl={analyticsUrl}
        databasesUrl={databasesUrl}
        settingsUrl={settingsUrl}
      />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}