'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function NewPublicationPage() {
  const router = useRouter()

  // Required fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [subdomainManuallyEdited, setSubdomainManuallyEdited] = useState(false)
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

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      const newSlug = slugify(value)
      setSlug(newSlug)
      if (!subdomainManuallyEdited) setSubdomain(newSlug)
      debouncedSlugCheck(newSlug)
    }
    if (!senderNameManuallyEdited) setSenderName(value)
  }

  // Debounced slug availability check
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    }
  }, [])

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(sanitized)
    setSlugManuallyEdited(true)
    if (!subdomainManuallyEdited) setSubdomain(sanitized)
    debouncedSlugCheck(sanitized)
  }

  // Image preview helpers
  const handleFileSelect = (file: File | null, type: 'logo' | 'header') => {
    if (!file) return
    const url = URL.createObjectURL(file)
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
    subdomain.trim() &&
    contactEmail.trim() &&
    fromEmail.trim() &&
    slugAvailable !== false &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    try {
      // Step 1: Provision publication
      setSubmitPhase('Creating publication...')
      const provisionRes = await fetch('/api/publications/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          subdomain: subdomain.trim(),
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

      // Step 2: Upload images if provided
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
          // Update the setting
          await fetch('/api/settings/publication', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publication_id: publicationId,
              settings: { logo_url: logoUrl },
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
              settings: { header_image_url: headerImageUrl },
            }),
          })
        }
      }

      // Step 3: Redirect to settings
      setSubmitPhase('Redirecting...')
      router.push(`/dashboard/${slug}/settings`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setSubmitting(false)
      setSubmitPhase('')
    }
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to publications
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Publication</h1>
            <p className="mt-1 text-sm text-gray-600">
              Set up a new newsletter publication with all required modules and settings.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Publication Identity */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Publication Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Pros Daily"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ai-pros-daily"
                  />
                  {slugChecking && (
                    <span className="text-sm text-gray-400">Checking...</span>
                  )}
                  {!slugChecking && slugAvailable === true && slug && (
                    <span className="text-sm text-green-600">Available</span>
                  )}
                  {!slugChecking && slugAvailable === false && (
                    <span className="text-sm text-red-600">Taken</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subdomain <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => { setSubdomain(e.target.value); setSubdomainManuallyEdited(true) }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ai-pros-daily"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website Domain
                  </label>
                  <input
                    type="text"
                    value={websiteDomain}
                    onChange={(e) => setWebsiteDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="aiprodaily.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Email Configuration */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Email Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@yourpublication.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => { setSenderName(e.target.value); setSenderNameManuallyEdited(true) }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Defaults to publication name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="hello@yourpublication.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Branding */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="#1C293D"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Images (collapsible) */}
          <div className="bg-white shadow rounded-lg mb-6">
            <button
              onClick={() => setShowImages(!showImages)}
              className="w-full p-6 flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-medium text-gray-900">Images</h2>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showImages ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showImages && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                  {logoPreview && (
                    <div className="mb-2">
                      <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-cover rounded border" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'logo')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Header Image</label>
                  {headerPreview && (
                    <div className="mb-2 p-4 rounded border" style={{ backgroundColor: primaryColor }}>
                      <img src={headerPreview} alt="Header preview" className="max-w-full h-32 object-contain mx-auto" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'header')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Social URLs (collapsible) */}
          <div className="bg-white shadow rounded-lg mb-6">
            <button
              onClick={() => setShowSocial(!showSocial)}
              className="w-full p-6 flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-medium text-gray-900">Social Media Links</h2>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showSocial ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSocial && (
              <div className="px-6 pb-6 space-y-4">
                {[
                  { label: 'Facebook', enabled: facebookEnabled, setEnabled: setFacebookEnabled, url: facebookUrl, setUrl: setFacebookUrl, placeholder: 'https://facebook.com/yourpage' },
                  { label: 'Twitter/X', enabled: twitterEnabled, setEnabled: setTwitterEnabled, url: twitterUrl, setUrl: setTwitterUrl, placeholder: 'https://twitter.com/yourhandle' },
                  { label: 'LinkedIn', enabled: linkedinEnabled, setEnabled: setLinkedinEnabled, url: linkedinUrl, setUrl: setLinkedinUrl, placeholder: 'https://linkedin.com/company/yourcompany' },
                  { label: 'Instagram', enabled: instagramEnabled, setEnabled: setInstagramEnabled, url: instagramUrl, setUrl: setInstagramUrl, placeholder: 'https://instagram.com/yourhandle' },
                ].map((social) => (
                  <div key={social.label}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">{social.label}</label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={social.enabled}
                          onChange={(e) => social.setEnabled(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Enable</span>
                      </label>
                    </div>
                    <input
                      type="url"
                      value={social.url}
                      onChange={(e) => social.setUrl(e.target.value)}
                      disabled={!social.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder={social.placeholder}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6: MailerLite (collapsible) */}
          <div className="bg-white shadow rounded-lg mb-6">
            <button
              onClick={() => setShowMailerLite(!showMailerLite)}
              className="w-full p-6 flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-medium text-gray-900">MailerLite Configuration</h2>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showMailerLite ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMailerLite && (
              <div className="px-6 pb-6 space-y-4">
                <p className="text-sm text-gray-500">
                  You can set these later in the publication settings. Group IDs come from your MailerLite dashboard.
                </p>
                {[
                  { label: 'Main Group ID', value: mlMainGroupId, setValue: setMlMainGroupId },
                  { label: 'Review Group ID', value: mlReviewGroupId, setValue: setMlReviewGroupId },
                  { label: 'Test Group ID', value: mlTestGroupId, setValue: setMlTestGroupId },
                  { label: 'Signup Group ID', value: mlSignupGroupId, setValue: setMlSignupGroupId },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => field.setValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 123456789"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm"
            >
              {submitting ? submitPhase : 'Create Publication'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
