'use client'

import { useBusinessSettings, fontOptions } from './useBusinessSettings'

export default function BusinessSettings({ publicationId }: { publicationId: string }) {
  const {
    settings,
    setSettings,
    loading,
    saving,
    uploadingHeader,
    uploadingLogo,
    uploadingWebsiteHeader,
    message,
    handleSave,
    handleImageUpload,
  } = useBusinessSettings(publicationId)

  if (loading) {
    return <div className="text-center py-8">Loading business settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <TextInput label="Publication Name" value={settings.newsletter_name}
            onChange={(v) => setSettings({ ...settings, newsletter_name: v })} placeholder="e.g., AI Accounting Daily" />
          <TextInput label="Business Name" value={settings.business_name}
            onChange={(v) => setSettings({ ...settings, business_name: v })} placeholder="e.g., AI Pros Inc." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line Emoji</label>
            <input type="text" value={settings.subject_line_emoji}
              onChange={(e) => setSettings({ ...settings, subject_line_emoji: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., " maxLength={2} />
            <p className="mt-1 text-sm text-gray-500">This emoji will appear at the beginning of all email subject lines</p>
          </div>
          <TextInput label="Contact Email" value={settings.contact_email} type="email"
            onChange={(v) => setSettings({ ...settings, contact_email: v })} placeholder="e.g., contact@aiaccountingdaily.com" />
          <TextInput label="Website URL" value={settings.website_url} type="url"
            onChange={(v) => setSettings({ ...settings, website_url: v })} placeholder="e.g., https://aiaccountingdaily.com" />
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker label="Primary Color (Header/Footer Background)" value={settings.primary_color}
            onChange={(v) => setSettings({ ...settings, primary_color: v })} />
          <ColorPicker label="Secondary Color (Buttons/Links)" value={settings.secondary_color}
            onChange={(v) => setSettings({ ...settings, secondary_color: v })} />
          <ColorPicker label="Tertiary Color (Accents)" value={settings.tertiary_color}
            onChange={(v) => setSettings({ ...settings, tertiary_color: v })} />
        </div>
      </div>

      {/* Fonts */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Typography</h3>
        <div className="grid grid-cols-2 gap-4">
          <FontPicker label="Heading Font" value={settings.heading_font}
            onChange={(v) => setSettings({ ...settings, heading_font: v })}
            previewText="This is how your headings will look in the newsletter." />
          <FontPicker label="Body Font" value={settings.body_font}
            onChange={(v) => setSettings({ ...settings, body_font: v })}
            previewText="This is how your body text will appear in the newsletter." />
        </div>
      </div>

      {/* Images */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>
        <ImageUpload label="Email Header Image" imageUrl={settings.header_image_url}
          uploading={uploadingHeader} onUpload={(f) => handleImageUpload(f, 'header')}
          previewBg={settings.primary_color} />
        <ImageUpload label="Logo (Square Image)" imageUrl={settings.logo_url}
          uploading={uploadingLogo} onUpload={(f) => handleImageUpload(f, 'logo')} isLogo />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Website Header Image</label>
          <p className="text-xs text-gray-500 mb-2">This image appears in the website header navigation.</p>
          {settings.website_header_url && (
            <div className="mb-2 p-4 rounded border">
              <img src={settings.website_header_url} alt="Website header preview" className="max-w-md h-32 object-contain mx-auto" />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input type="file" accept="image/*"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file, 'website_header') }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingWebsiteHeader} />
            {uploadingWebsiteHeader && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>
      </div>

      {/* Social Media */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Social Media Links</h3>
        <p className="text-sm text-gray-600 mb-4">Enable individual social media links to display in the newsletter footer.</p>
        <div className="space-y-4">
          {([
            { label: 'Facebook', enabledKey: 'facebook_enabled', urlKey: 'facebook_url', placeholder: 'https://facebook.com/yourpage' },
            { label: 'Twitter/X', enabledKey: 'twitter_enabled', urlKey: 'twitter_url', placeholder: 'https://twitter.com/yourhandle' },
            { label: 'LinkedIn', enabledKey: 'linkedin_enabled', urlKey: 'linkedin_url', placeholder: 'https://linkedin.com/company/yourcompany' },
            { label: 'Instagram', enabledKey: 'instagram_enabled', urlKey: 'instagram_url', placeholder: 'https://instagram.com/yourhandle' },
          ] as const).map((social) => (
            <SocialInput key={social.label} label={social.label}
              enabled={settings[social.enabledKey] as boolean}
              onEnabledChange={(v) => setSettings({ ...settings, [social.enabledKey]: v })}
              url={settings[social.urlKey] as string}
              onUrlChange={(v) => setSettings({ ...settings, [social.urlKey]: v })}
              placeholder={social.placeholder} />
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium">
          {saving ? 'Saving...' : 'Save Publication Settings'}
        </button>
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder} />
    </div>
  )
}

function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center space-x-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-20 border border-gray-300 rounded cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>
  )
}

function FontPicker({ label, value, onChange, previewText }: {
  label: string; value: string; onChange: (v: string) => void; previewText: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
        {fontOptions.map(font => <option key={font} value={font}>{font}</option>)}
      </select>
      <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: value }}>{previewText}</p>
    </div>
  )
}

function ImageUpload({ label, imageUrl, uploading, onUpload, previewBg, isLogo }: {
  label: string; imageUrl: string; uploading: boolean; onUpload: (f: File) => void; previewBg?: string; isLogo?: boolean
}) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {imageUrl && (
        isLogo ? (
          <div className="mb-2">
            <img src={imageUrl} alt="Logo preview" className="w-16 h-16 object-cover rounded border" />
          </div>
        ) : (
          <div className="mb-2 p-4 rounded border" style={{ backgroundColor: previewBg }}>
            <img src={imageUrl} alt="Header preview" className="max-w-md h-32 object-contain mx-auto" />
          </div>
        )
      )}
      <div className="flex items-center space-x-2">
        <input type="file" accept="image/*"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file) }}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={uploading} />
        {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
      </div>
    </div>
  )
}

function SocialInput({ label, enabled, onEnabledChange, url, onUrlChange, placeholder }: {
  label: string; enabled: boolean; onEnabledChange: (v: boolean) => void
  url: string; onUrlChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-gray-700">Enable</span>
        </label>
      </div>
      <input type="url" value={url} onChange={(e) => onUrlChange(e.target.value)} disabled={!enabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        placeholder={placeholder} />
    </div>
  )
}
