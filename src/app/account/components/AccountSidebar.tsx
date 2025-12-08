'use client'

import { useUser, UserButton, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  User,
  Megaphone,
  CreditCard,
  Settings,
  HelpCircle,
  Star,
  Newspaper,
  Menu,
  X,
  ExternalLink,
  ChevronDown
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
  },
  {
    name: 'My Ads',
    href: '/account/ads',
    icon: Megaphone,
    children: [
      { name: 'Tool Profile', href: '/account/ads/profile', icon: Star },
      { name: 'Newsletter', href: '/account/ads/newsletter', icon: Newspaper }
    ]
  },
  {
    name: 'Billing',
    href: '/account/billing',
    icon: CreditCard,
  },
  {
    name: 'Settings',
    href: '/account/settings',
    icon: Settings,
  },
]

export function AccountSidebar({ children, newsletterName, logoUrl }: AccountSidebarProps) {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const SidebarContent = () => (
    <nav className="flex h-full flex-col">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={newsletterName}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{newsletterName}</span>
            <span className="block truncate text-xs text-slate-500">Customer Portal</span>
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
                avatarBox: "h-10 w-10"
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {user?.fullName || 'User'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
        </div>
        <div className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = item.href === '/account'
              ? pathname === '/account'
              : pathname.startsWith(item.href)

            return (
              <div key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                  {item.children && (
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isActive ? 'rotate-180' : ''}`} />
                  )}
                </Link>

                {/* Sub-navigation */}
                {item.children && isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isChildActive
                              ? 'text-blue-600 font-medium'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <child.icon className={`h-4 w-4 ${isChildActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span>{child.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Links */}
      <div className="p-4 border-t border-slate-200 space-y-1">
        <Link
          href="/contactus"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <HelpCircle className="h-5 w-5 text-slate-400" />
          <span>Support</span>
        </Link>
        <Link
          href="/tools"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <ExternalLink className="h-5 w-5 text-slate-400" />
          <span>View Directory</span>
        </Link>
      </div>
    </nav>
  )

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-slate-50 flex">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-slate-200 lg:bg-white">
            <SidebarContent />
          </aside>

          {/* Mobile sidebar */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="fixed inset-0 bg-slate-900/50"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-xl">
                <div className="flex items-center justify-end p-4 border-b border-slate-200">
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SidebarContent />
              </div>
            </div>
          )}

          {/* Mobile header */}
          <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-4 px-4 py-3 bg-white border-b border-slate-200">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-slate-900">{newsletterName}</span>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 lg:pl-72">
            <div className="py-8 px-4 sm:px-6 lg:px-8 lg:py-10 mt-14 lg:mt-0">
              <div className="mx-auto max-w-4xl">
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
