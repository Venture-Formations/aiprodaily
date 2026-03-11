'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

/**
 * Hook that resolves the current publication ID from the dashboard [slug] URL param.
 * Caches the result so the lookup only happens once per slug.
 */
const cache = new Map<string, string>()

export function usePublicationId(): { publicationId: string | null; isLoading: boolean } {
  const params = useParams()
  const slug = (params?.slug as string) || ''
  const [publicationId, setPublicationId] = useState<string | null>(cache.get(slug) || null)
  const [isLoading, setIsLoading] = useState(!cache.has(slug))

  useEffect(() => {
    if (!slug) return
    if (cache.has(slug)) {
      setPublicationId(cache.get(slug)!)
      setIsLoading(false)
      return
    }

    fetch('/api/newsletters')
      .then(res => res.json())
      .then(data => {
        const pub = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
        if (pub) {
          cache.set(slug, pub.id)
          setPublicationId(pub.id)
        }
      })
      .catch(err => console.error('Failed to resolve publicationId:', err))
      .finally(() => setIsLoading(false))
  }, [slug])

  return { publicationId, isLoading }
}
