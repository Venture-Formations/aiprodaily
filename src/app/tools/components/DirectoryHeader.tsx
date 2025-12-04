'use client'

import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

interface DirectoryHeaderProps {
  logoUrl: string
  newsletterName: string
}

export function DirectoryHeader({ logoUrl, newsletterName }: DirectoryHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img src={logoUrl} alt={newsletterName} className="h-10 object-contain" />
          </Link>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <Link 
              href="/" 
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Home
            </Link>
            <Link 
              href="/tools" 
              className="text-sm font-medium text-gray-900 transition-colors"
            >
              AI Tools
            </Link>
            <Link 
              href="/contactus" 
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Contact Us
            </Link>
          </nav>

          {/* Right side - Auth & CTA */}
          <div className="flex items-center gap-3">
            {/* User Profile / Sign In */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            
            <SignedIn>
              <UserButton 
                afterSignOutUrl="/tools"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </SignedIn>

            {/* Sponsorship CTA */}
            <SignedOut>
              <SignInButton mode="modal" fallbackRedirectUrl="/account/ads">
                <button className="hidden sm:inline-flex bg-[#1c293d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1c293d]/90 transition-colors">
                  Sponsorship
                </button>
              </SignInButton>
            </SignedOut>
            
            <SignedIn>
              <Link
                href="/account/ads"
                className="hidden sm:inline-flex bg-[#1c293d] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1c293d]/90 transition-colors"
              >
                Sponsorship
              </Link>
            </SignedIn>
            
            {/* Mobile menu button */}
            <button className="md:hidden p-2 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

