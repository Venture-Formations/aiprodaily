'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function useNewPublication() {
  const router = useRouter()

  // Required fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [websiteDomain, setWebsiteDomain] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderNameManuallyEdited, setSenderNameManuallyEdited] = useState(false)
  const [fromEmail, setFromEmail] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1C293D')

  // Images
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [headerFile, setHeaderFile] = useState<File | null>(null)
  const [headerPreview, setHeaderPreview] = useState('')

  // Social
  const [facebookEnabled, setFacebookEnabled] = useState(false)
  const [facebookUrl, setFacebookUrl] = useState('')
  const [twitterEnabled, setTwitterEnabled] = useState(false)
  const [twitterUrl, setTwitterUrl] = useState('')
  const [linkedinEnabled, setLinkedinEnabled] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [instagramEnabled, setInstagramEnabled] = useState(false)
  const [instagramUrl, setInstagramUrl] = useState('')

  // MailerLite
  const [mlMainGroupId, setMlMainGroupId] = useState('')
  const [mlReviewGroupId, setMlReviewGroupId] = useState('')
  const [mlTestGroupId, setMlTestGroupId] = useState('')
  const [mlSignupGroupId, setMlSignupGroupId] = useState('')

  // Collapsible sections
  const [showImages, setShowImages] = useState(false)
  const [showSocial, setShowSocial] = useState(false)
  const [showMailerLite, setShowMailerLite] = useState(false)

  // Slug availability
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitPhase, setSubmitPhase] = useState('')
  const [error, setError] = useState('')

  const debouncedSlugCheck = useCallback((slugValue: string) => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    if (!slugValue || slugValue.length < 2) {
      setSlugAvailable(null)
      return
    }
    setSlugChecking(true)
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/publications/check-slug?slug=${encodeURIComponent(slugValue)}`)
        if (res.ok) {
          const data = await res.json()
          setSlugAvailable(data.available)
        }
      } catch {
        setSlugAvailable(null)
      } finally {
        setSlugChecking(false)
      }
    }, 400)
  }, [])

  useEffect(() => {
    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    }
  }, [])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      const newSlug = slugify(value)
      setSlug(newSlug)
      debouncedSlugCheck(newSlug)
    }
    if (!senderNameManuallyEdited) setSenderName(value)
  }

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(sanitized)
    setSlugManuallyEdited(true)
    debouncedSlugCheck(sanitized)
  }

  const handleFileSelect = (file: File | null, type: 'logo' | 'header') => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (!url.startsWith('blob:')) return
    if (type === 'logo') {
      setLogoFile(file)
      setLogoPreview(url)
    } else {
      setHeaderFile(file)
      setHeaderPreview(url)
    }
  }

  const canSubmit =
    name.trim() &&
    slug.trim() &&
    websiteDomain.trim() &&
    contactEmail.trim() &&
    fromEmail.trim() &&
    slugAvailable !== false &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    try {
      setSubmitPhase('Creating publication...')
      const provisionRes = await fetch('/api/publications/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          contactEmail: contactEmail.trim(),
          senderName: (senderName || name).trim(),
          fromEmail: fromEmail.trim(),
          primaryColor,
          websiteDomain: websiteDomain.trim(),
          facebookEnabled,
          facebookUrl: facebookEnabled ? facebookUrl.trim() : '',
          twitterEnabled,
          twitterUrl: twitterEnabled ? twitterUrl.trim() : '',
          linkedinEnabled,
          linkedinUrl: linkedinEnabled ? linkedinUrl.trim() : '',
          instagramEnabled,
          instagramUrl: instagramEnabled ? instagramUrl.trim() : '',
          mailerliteMainGroupId: mlMainGroupId.trim(),
          mailerliteReviewGroupId: mlReviewGroupId.trim(),
          mailerliteTestGroupId: mlTestGroupId.trim(),
          mailerliteSignupGroupId: mlSignupGroupId.trim(),
        }),
      })

      if (!provisionRes.ok) {
        const data = await provisionRes.json()
        throw new Error(data.error || data.message || 'Failed to create publication')
      }

      const { publicationId } = await provisionRes.json()

      if (logoFile || headerFile) {
        setSubmitPhase('Uploading images...')

        const uploadImage = async (file: File, type: string) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('type', type)
          formData.append('publication_id', publicationId)
          const res = await fetch('/api/settings/upload-business-image', {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) throw new Error(`Failed to upload ${type} image`)
          return (await res.json()).url
        }

        if (logoFile) {
          const logoUrl = await uploadImage(logoFile, 'logo')
          await fetch('/api/settings/publication', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publication_id: publicationId,
              key: 'logo_url',
              value: logoUrl,
            }),
          })
        }

        if (headerFile) {
          const headerImageUrl = await uploadImage(headerFile, 'header')
          await fetch('/api/settings/publication', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publication_id: publicationId,
              key: 'header_image_url',
              value: headerImageUrl,
            }),
          })
        }
      }

      setSubmitPhase('Redirecting...')
      router.push(`/dashboard/${slug}/settings`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setSubmitting(false)
      setSubmitPhase('')
    }
  }

  const socialFields = [
    { label: 'Facebook', enabled: facebookEnabled, setEnabled: setFacebookEnabled, url: facebookUrl, setUrl: setFacebookUrl, placeholder: 'https://facebook.com/yourpage' },
    { label: 'Twitter/X', enabled: twitterEnabled, setEnabled: setTwitterEnabled, url: twitterUrl, setUrl: setTwitterUrl, placeholder: 'https://twitter.com/yourhandle' },
    { label: 'LinkedIn', enabled: linkedinEnabled, setEnabled: setLinkedinEnabled, url: linkedinUrl, setUrl: setLinkedinUrl, placeholder: 'https://linkedin.com/company/yourcompany' },
    { label: 'Instagram', enabled: instagramEnabled, setEnabled: setInstagramEnabled, url: instagramUrl, setUrl: setInstagramUrl, placeholder: 'https://instagram.com/yourhandle' },
  ]

  const mailerliteFields = [
    { label: 'Main Group ID', value: mlMainGroupId, setValue: setMlMainGroupId },
    { label: 'Review Group ID', value: mlReviewGroupId, setValue: setMlReviewGroupId },
    { label: 'Test Group ID', value: mlTestGroupId, setValue: setMlTestGroupId },
    { label: 'Signup Group ID', value: mlSignupGroupId, setValue: setMlSignupGroupId },
  ]

  return {
    router,
    name, handleNameChange,
    slug, handleSlugChange, slugChecking, slugAvailable,
    websiteDomain, setWebsiteDomain,
    contactEmail, setContactEmail,
    senderName, setSenderName, setSenderNameManuallyEdited,
    fromEmail, setFromEmail,
    primaryColor, setPrimaryColor,
    logoPreview, headerPreview, handleFileSelect,
    showImages, setShowImages,
    showSocial, setShowSocial,
    showMailerLite, setShowMailerLite,
    socialFields,
    mailerliteFields,
    canSubmit, submitting, submitPhase, error,
    handleSubmit,
  }
}
