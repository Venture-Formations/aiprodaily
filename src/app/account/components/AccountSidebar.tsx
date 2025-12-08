'use client'

import { useUser, UserButton, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User,
  Megaphone,
  CreditCard,
  Settings,
  HelpCircle,
  ChevronRight,
  Newspaper,
  Star
} from 'lucide-react'

interface AccountSidebarProps {
  children: React.ReactNode
  newsletterName: string
  logoUrl: string | null
}

const navigation = [
  {
    name: 'My Profile',
    href: '/account',
    icon: User,
    description: 'Manage your tool listing'
  },
  {
    name: 'My Ads',
    href: '/account/ads',
    icon: Megaphone,
    description: 'Manage advertisements',
    children: [
      { name: 'Tool Profile', href: '/account/ads/profile', icon: Star },
      { name: 'Newsletter', href: '/account/ads/newsletter', icon: Newspaper }
    ]
  },
  {
    name: 'Billing',
    href: '/account/billing',
    icon: CreditCard,
    description: 'Manage subscription & payments'
  },
  {
    name: 'Settings',
    href: '/account/settings',
    icon: Settings,
    description: 'Account preferences'
  },
]

export function AccountSidebar({ children, newsletterName, logoUrl }: AccountSidebarProps) {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
      </div>
    )
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-slate-50 flex">
          {/* Sidebar - Slate theme */}
          <aside className="w-80 bg-slate-100 min-h-screen flex flex-col fixed left-0 top-0 border-r border-slate-200">
            {/* Logo */}
            <div className="px-6 h-[72px] flex items-center bg-slate-900">
              <Link href="/" className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={newsletterName}
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">AI</span>
                  </div>
                )}
                <div>
                  <h2 className="text-white font-semibold text-base">{newsletterName}</h2>
                  <p className="text-slate-400 text-sm">Customer Portal</p>
                </div>
              </Link>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-12 h-12"
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-medium text-base truncate">
                    {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User'}
                  </p>
                  <p className="text-slate-500 text-sm truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
              <div className="px-4 mb-2">
                <p className="text-slate-400 text-sm uppercase tracking-wider font-medium">Menu</p>
              </div>
              {navigation.map((item) => {
                const isActive = item.href === '/account'
                  ? pathname === '/account'
                  : pathname.startsWith(item.href)

                return (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-6 py-3.5 text-base transition-all ${
                        isActive
                          ? 'bg-white border-l-[3px] border-blue-600 text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : ''}`} />
                      <span className="font-medium">{item.name}</span>
                      {item.children && (
                        <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${isActive ? 'rotate-90' : ''}`} />
                      )}
                    </Link>
                    {/* Sub-navigation */}
                    {item.children && isActive && (
                      <div className="ml-6 border-l border-slate-200">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`flex items-center gap-3 px-6 py-2.5 text-base transition-colors ${
                              pathname === child.href
                                ? 'text-blue-600 font-medium'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            <span>{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            {/* Help Section */}
            <div className="p-4 border-t border-slate-200">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <p className="text-slate-900 text-base font-medium">Need help?</p>
                </div>
                <p className="text-slate-500 text-sm mb-3">
                  Contact our support team for assistance.
                </p>
                <a
                  href="/contactus"
                  className="block w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-base text-center transition-colors"
                >
                  Get Support
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-80">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <div className="px-8 h-[72px] flex items-center justify-end gap-4">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  View Directory
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </header>

            {/* Page Content */}
            <div className="p-8">
              <div className="max-w-4xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
