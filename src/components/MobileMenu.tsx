'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  onSignOut?: () => void
  userDisplay?: string
  dashboardUrl?: string
  campaignsUrl?: string
  analyticsUrl?: string
  databasesUrl?: string
  settingsUrl?: string
}

export default function MobileMenu({
  isOpen,
  onClose,
  onSignOut,
  userDisplay,
  dashboardUrl = '/dashboard',
  campaignsUrl = '/dashboard/issues',
  analyticsUrl = '/dashboard/analytics',
  databasesUrl = '/dashboard/databases',
  settingsUrl = '/dashboard/settings'
}: MobileMenuProps) {
  const pathname = usePathname()

  // Close menu on route change
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const navLinks = [
    { href: dashboardUrl, label: 'Dashboard' },
    { href: campaignsUrl, label: 'Campaigns' },
    { href: analyticsUrl, label: 'Analytics' },
    { href: databasesUrl, label: 'Databases' },
    { href: settingsUrl, label: 'Settings' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Menu */}
      <div
        className="fixed inset-y-0 right-0 w-64 bg-white shadow-xl z-50 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-900">Menu</span>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label="Close menu"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Info & Sign Out */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-3">
            {userDisplay && (
              <div className="text-sm text-gray-700 px-3 py-2">
                {userDisplay}
              </div>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-full px-3 py-2 text-left text-base font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
