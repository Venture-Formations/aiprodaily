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
  Star,
  Search
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700"></div>
      </div>
    )
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 flex">
          {/* Sidebar - Light Gray */}
          <aside className="w-80 bg-gray-100 min-h-screen flex flex-col fixed left-0 top-0 border-r border-gray-200">
            {/* Logo */}
            <div className="px-6 h-[72px] flex items-center bg-[#1c293d]">
              <Link href="/" className="flex items-center gap-3">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={newsletterName}
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] flex items-center justify-center">
                    <span className="text-white font-bold text-xl">AI</span>
                  </div>
                )}
                <div>
                  <h2 className="text-white font-semibold text-base">{newsletterName}</h2>
                  <p className="text-white/60 text-sm">Customer Portal</p>
                </div>
              </Link>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200">
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
                  <p className="text-gray-900 font-medium text-base truncate">
                    {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User'}
                  </p>
                  <p className="text-gray-500 text-sm truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
              <div className="px-4 mb-2">
                <p className="text-gray-400 text-sm uppercase tracking-wider font-medium">Menu</p>
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
                          ? 'bg-white border-l-[3px] border-[#06b6d4] text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-[#06b6d4]' : ''}`} />
                      <span className="font-medium">{item.name}</span>
                      {item.children && (
                        <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${isActive ? 'rotate-90' : ''}`} />
                      )}
                    </Link>
                    {/* Sub-navigation */}
                    {item.children && isActive && (
                      <div className="ml-6 border-l border-gray-200">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className="flex items-center gap-3 px-6 py-2.5 text-base text-gray-500 hover:text-gray-900 transition-colors"
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
            <div className="p-4 border-t border-gray-200">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-5 h-5 text-[#06b6d4]" />
                  <p className="text-gray-900 text-base font-medium">Need help?</p>
                </div>
                <p className="text-gray-500 text-sm mb-3">
                  Contact our support team for assistance.
                </p>
                <a 
                  href="/contactus"
                  className="block w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-base text-center transition-colors"
                >
                  Get Support
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-80">
            {/* Top Bar with Search */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
              <div className="px-8 h-[72px] flex items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="flex-1 max-w-xl">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Link 
                    href="/tools"
                    className="text-base text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    View Directory →
                  </Link>
                </div>
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
