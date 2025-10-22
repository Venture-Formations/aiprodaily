'use client'

import { useEffect, useState } from 'react'

interface FooterProps {
  logoUrl?: string
  newsletterName?: string
  businessName?: string
  currentYear?: number
}

export function Footer({ 
  logoUrl: initialLogoUrl, 
  newsletterName: initialNewsletterName, 
  businessName: initialBusinessName,
  currentYear: initialCurrentYear 
}: FooterProps = {}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || '/logo.png')
  const [newsletterName, setNewsletterName] = useState(initialNewsletterName || 'AI Accounting Daily')
  const [businessName, setBusinessName] = useState(initialBusinessName || 'AI Accounting Daily')
  const currentYear = initialCurrentYear || new Date().getFullYear()

  useEffect(() => {
    // If props weren't provided, fetch from API (for client components)
    if (!initialLogoUrl || !initialNewsletterName || !initialBusinessName) {
      fetch('/api/settings/footer')
        .then(res => res.json())
        .then(data => {
          if (data.logoUrl) setLogoUrl(data.logoUrl)
          if (data.newsletterName) setNewsletterName(data.newsletterName)
          if (data.businessName) setBusinessName(data.businessName)
        })
        .catch(err => console.error('Failed to fetch footer settings:', err))
    }
  }, [initialLogoUrl, initialNewsletterName, initialBusinessName])

  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-[#1c293d] text-white">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoUrl} alt={newsletterName} className="w-8 h-8 object-contain" />
              <span className="font-bold text-base">{newsletterName}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              Empowering accountants and finance professionals with daily AI insights, tools, and strategies.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <a href="/" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Contact</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-center text-white/60 text-xs">
          <p>© {currentYear} {businessName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
