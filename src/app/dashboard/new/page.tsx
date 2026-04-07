'use client'

import Layout from '@/components/Layout'
import { useNewPublication } from './useNewPublication'

export default function NewPublicationPage() {
  const {
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
  } = useNewPublication()

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to publications
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Publication</h1>
            <p className="mt-1 text-sm text-gray-600">Set up a new newsletter publication with all required modules and settings.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
          )}

          {/* Section 1: Publication Identity */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Publication Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., AI Pros Daily" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug <span className="text-red-500">*</span></label>
                <div className="flex items-center space-x-2">
                  <input type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ai-pros-daily" />
                  {slugChecking && <span className="text-sm text-gray-400">Checking...</span>}
                  {!slugChecking && slugAvailable === true && slug && <span className="text-sm text-green-600">Available</span>}
                  {!slugChecking && slugAvailable === false && <span className="text-sm text-red-600">Taken</span>}
                </div>
                <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website Domain <span className="text-red-500">*</span></label>
                <input type="text" value={websiteDomain} onChange={(e) => setWebsiteDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="aiprodaily.com" />
                <p className="mt-1 text-xs text-gray-500">The custom domain for this publication&apos;s website (without https://)</p>
              </div>
            </div>
          </div>

          {/* Section 2: Email Configuration */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Email Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email <span className="text-red-500">*</span></label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="contact@yourpublication.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                  <input type="text" value={senderName}
                    onChange={(e) => { setSenderName(e.target.value); setSenderNameManuallyEdited(true) }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="Defaults to publication name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Email <span className="text-red-500">*</span></label>
                  <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="hello@yourpublication.com" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Branding */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color <span className="text-red-500">*</span></label>
              <div className="flex items-center space-x-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer" />
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="#1C293D" />
              </div>
            </div>
          </div>

          {/* Section 4: Images (collapsible) */}
          <CollapsibleSection title="Images" open={showImages} onToggle={() => setShowImages(!showImages)}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
              {logoPreview && <div className="mb-2"><img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-cover rounded border" /></div>}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'logo')}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Header Image</label>
              {headerPreview && (
                <div className="mb-2 p-4 rounded border" style={{ backgroundColor: primaryColor }}>
                  <img src={headerPreview} alt="Header preview" className="max-w-full h-32 object-contain mx-auto" />
                </div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'header')}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </CollapsibleSection>

          {/* Section 5: Social URLs (collapsible) */}
          <CollapsibleSection title="Social Media Links" open={showSocial} onToggle={() => setShowSocial(!showSocial)}>
            {socialFields.map((social) => (
              <div key={social.label}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">{social.label}</label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={social.enabled} onChange={(e) => social.setEnabled(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Enable</span>
                  </label>
                </div>
                <input type="url" value={social.url} onChange={(e) => social.setUrl(e.target.value)} disabled={!social.enabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder={social.placeholder} />
              </div>
            ))}
          </CollapsibleSection>

          {/* Section 6: MailerLite (collapsible) */}
          <CollapsibleSection title="MailerLite Configuration" open={showMailerLite} onToggle={() => setShowMailerLite(!showMailerLite)}>
            <p className="text-sm text-gray-500">You can set these later in the publication settings. Group IDs come from your MailerLite dashboard.</p>
            {mailerliteFields.map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input type="text" value={field.value} onChange={(e) => field.setValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 123456789" />
              </div>
            ))}
          </CollapsibleSection>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm">
              {submitting ? submitPhase : 'Create Publication'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <button onClick={onToggle} className="w-full p-6 flex items-center justify-between text-left">
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6 space-y-4">{children}</div>}
    </div>
  )
}
