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

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-700"></div>
      </div>
    )
  }

  const SidebarContent = () => (
    <nav className="flex h-full min-h-0 flex-col">
      {/* Sidebar Header - Logo & Brand */}
      <div className="flex flex-col border-b border-white/5 p-4">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={newsletterName}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{newsletterName}</span>
            <span className="block truncate text-xs text-zinc-400">Customer Portal</span>
          </div>
        </Link>
      </div>

      {/* Sidebar Body - Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {/* Main Navigation Section */}
        <div className="flex flex-col gap-0.5">
          {navigation.map((item) => {
            const isActive = item.href === '/account'
              ? pathname === '/account'
              : pathname.startsWith(item.href)
            const isParentOfActive = item.children?.some(child => pathname === child.href)

            return (
              <div key={item.name}>
                <span className="relative">
                  {isActive && !isParentOfActive && (
                    <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-white" />
                  )}
                  <Link
                    href={item.href}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                    <span className="truncate">{item.name}</span>
                    {item.children && (
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isActive ? 'rotate-180' : ''}`} />
                    )}
                  </Link>
                </span>

                {/* Sub-navigation */}
                {item.children && isActive && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href
                      return (
                        <span key={child.name} className="relative">
                          {isChildActive && (
                            <span className="absolute inset-y-2 -left-3 w-0.5 rounded-full bg-white" />
                          )}
                          <Link
                            href={child.href}
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                              isChildActive
                                ? 'text-white font-medium'
                                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <child.icon className={`h-4 w-4 shrink-0 ${isChildActive ? 'text-white' : 'text-zinc-500'}`} />
                            <span className="truncate">{child.name}</span>
                          </Link>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="mt-8 flex-1" />

        {/* Support Section */}
        <div className="flex flex-col gap-0.5">
          <Link
            href="/contactus"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <HelpCircle className="h-5 w-5 shrink-0 text-zinc-500" />
            <span className="truncate">Support</span>
          </Link>
          <Link
            href="/tools"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ExternalLink className="h-5 w-5 shrink-0 text-zinc-500" />
            <span className="truncate">View Directory</span>
          </Link>
        </div>
      </div>

      {/* Sidebar Footer - User Account */}
      <div className="flex flex-col border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-10 w-10"
              }
            }}
          />
          <span className="flex min-w-0 flex-col">
            <span className="block truncate text-sm font-medium text-white">
              {user?.fullName || 'User'}
            </span>
            <span className="block truncate text-xs text-zinc-400">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </span>
        </div>
      </div>
    </nav>
  )

  return (
    <>
      <SignedIn>
        <div className="relative isolate flex min-h-screen w-full bg-white max-lg:flex-col lg:bg-zinc-100">
          {/* Sidebar on desktop - fixed position */}
          <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">
            <div className="flex h-full flex-col bg-zinc-900">
              <SidebarContent />
            </div>
          </div>

          {/* Mobile sidebar overlay */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Sidebar panel */}
              <div className="fixed inset-y-0 left-0 w-full max-w-80 p-2">
                <div className="flex h-full flex-col rounded-lg bg-zinc-900 shadow-xl ring-1 ring-white/10">
                  {/* Close button */}
                  <div className="flex items-center justify-end px-4 pt-3">
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <SidebarContent />
                </div>
              </div>
            </div>
          )}

          {/* Mobile header */}
          <header className="flex items-center px-4 lg:hidden border-b border-zinc-200 bg-white">
            <div className="py-2.5">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2.5 text-zinc-700 hover:bg-zinc-100"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between px-4">
              <span className="text-sm font-semibold text-zinc-900">{newsletterName}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex flex-1 flex-col pb-2 lg:min-w-0 lg:pt-2 lg:pr-2 lg:pl-64">
            <div className="grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-sm lg:ring-1 lg:ring-zinc-950/5">
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
