'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Newsletter } from '@/types/database'

interface NewsletterContextType {
  newsletter: Newsletter | null
  setNewsletter: (newsletter: Newsletter | null) => void
  isLoading: boolean
}

const NewsletterContext = createContext<NewsletterContextType | undefined>(undefined)

export function NewsletterProvider({ children }: { children: React.ReactNode }) {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Extract subdomain from hostname
    const hostname = window.location.hostname
    const parts = hostname.split('.')

    // Development: Check for localhost subdomain pattern (e.g., accounting.localhost)
    const isDevelopment = hostname.includes('localhost')

    if (isDevelopment && parts.length > 1 && parts[0] !== 'localhost') {
      // accounting.localhost:3000 or accounting.localhost
      const subdomain = parts[0]

      // Fetch newsletter by subdomain
      fetch(`/api/newsletters/by-subdomain?subdomain=${subdomain}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNewsletter(data.newsletter)
          }
          setIsLoading(false)
        })
        .catch(err => {
          console.error('Failed to load newsletter:', err)
          setIsLoading(false)
        })
    }
    // Production: subdomain exists and not 'admin' or 'www'
    else if (!isDevelopment && parts.length > 2 && parts[0] !== 'admin' && parts[0] !== 'www') {
      const subdomain = parts[0]

      // Fetch newsletter by subdomain
      fetch(`/api/newsletters/by-subdomain?subdomain=${subdomain}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNewsletter(data.newsletter)
          }
          setIsLoading(false)
        })
        .catch(err => {
          console.error('Failed to load newsletter:', err)
          setIsLoading(false)
        })
    } else {
      // No subdomain detected (admin or root domain)
      setIsLoading(false)
    }
  }, [pathname])

  return (
    <NewsletterContext.Provider value={{ newsletter, setNewsletter, isLoading }}>
      {children}
    </NewsletterContext.Provider>
  )
}

export function useNewsletter() {
  const context = useContext(NewsletterContext)
  if (context === undefined) {
    throw new Error('useNewsletter must be used within a NewsletterProvider')
  }
  return context
}
