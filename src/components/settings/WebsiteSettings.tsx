'use client'

import { useWebsiteSettings } from './useWebsiteSettings'

export default function WebsiteSettings({ publicationId }: { publicationId: string }) {
  const { settings, setSettings, loading, saving, message, websiteBaseUrl, handleSave } = useWebsiteSettings(publicationId)

  if (loading) {
    return <div className="text-gray-500">Loading website settings...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Website Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Control the text and features shown on your public website.</p>
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Home Page Hero Section */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Home Page Hero</h3>
          <a href={`${websiteBaseUrl}/`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>
        <SettingsInput label="Callout Text" value={settings.website_callout_text} onChange={(v) => setSettings(prev => ({ ...prev, website_callout_text: v }))} placeholder="Join 10,000+ accounting professionals" hint="The dark pill badge at the top of the home page." />
        <SettingsTextarea label="Heading" value={settings.website_heading} onChange={(v) => setSettings(prev => ({ ...prev, website_heading: v }))} placeholder={"Stay Ahead of **AI Trends**\nin Accounting and Finance"} rows={2} hint="Use Enter for line breaks. Wrap text in **double asterisks** for gradient underline style." />
        <SettingsTextarea label="Subheading" value={settings.website_subheading} onChange={(v) => setSettings(prev => ({ ...prev, website_subheading: v }))} placeholder="Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes." rows={3} hint="The description text below the heading." />
      </div>

      {/* Tracking */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Tracking</h3>
        <SettingsInput label="Meta Pixel ID" value={settings.meta_pixel_id} onChange={(v) => setSettings(prev => ({ ...prev, meta_pixel_id: v }))} placeholder="1651450039330329" hint="Your Facebook/Meta Pixel ID. Leave blank to disable. Each publication can have a different pixel." />
      </div>

      {/* Navigation Features */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Navigation</h3>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">AI Tools Directory</label>
            <p className="text-xs text-gray-400">Show the AI Tools link in website navigation.</p>
          </div>
          <button type="button" onClick={() => setSettings(prev => ({ ...prev, tools_directory_enabled: !prev.tools_directory_enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.tools_directory_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.tools_directory_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Subscribe Page */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Subscribe Page</h3>
          <a href={`${websiteBaseUrl}/subscribe`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>
        <SettingsTextarea label="Heading" value={settings.subscribe_heading} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_heading: v }))} placeholder={"Master AI Tools, Prompts & News\n**in Just 3 Minutes a Day**"} rows={2} hint="Use Enter for line breaks. Wrap text in **double asterisks** for gradient underline style." />
        <SettingsTextarea label="Subheadline" value={settings.subscribe_subheading} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_subheading: v }))} placeholder="Join 10,000+ accounting professionals staying current as AI reshapes bookkeeping, tax, and advisory work." rows={2} />
        <SettingsInput label="Tagline" value={settings.subscribe_tagline} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_tagline: v }))} placeholder="FREE FOREVER" hint="Shown below the subscribe form. Leave empty to hide." />
      </div>

      {/* Subscribe Info Page */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Subscribe Info Page</h3>
          <a href={`${websiteBaseUrl}/subscribe/info`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>
        <SettingsTextarea label="Heading" value={settings.subscribe_info_heading} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_info_heading: v }))} placeholder={"One Last Step!\n**Personalize Your Experience**"} rows={2} hint="Use Enter for line breaks. Wrap text in **double asterisks** for gradient underline style." />
        <SettingsTextarea label="Subheadline" value={settings.subscribe_info_subheading} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_info_subheading: v }))} placeholder="Help us tailor your newsletter to your needs. This only takes 30 seconds!" rows={2} />
        <SettingsInput label="Question 1 Label" value={settings.subscribe_info_job_label} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_info_job_label: v }))} placeholder="What best describes your role?" />

        <OptionsEditor
          label="Question 1 Options"
          options={settings.subscribe_info_job_options}
          onChange={(opts) => setSettings(prev => ({ ...prev, subscribe_info_job_options: opts }))}
        />

        <SettingsInput label="Question 2 Label" value={settings.subscribe_info_clients_label} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_info_clients_label: v }))} placeholder="How many clients' books/tax returns/financials do you handle yearly?" />

        <OptionsEditor
          label="Question 2 Options"
          options={settings.subscribe_info_clients_options}
          onChange={(opts) => setSettings(prev => ({ ...prev, subscribe_info_clients_options: opts }))}
        />

        <SettingsInput label="Submit Button Text" value={settings.subscribe_info_submit_text} onChange={(v) => setSettings(prev => ({ ...prev, subscribe_info_submit_text: v }))} placeholder="Complete Sign Up" />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Website Settings'}
        </button>
      </div>
    </div>
  )
}

function SettingsInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function SettingsTextarea({ label, value, onChange, placeholder, rows, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; rows: number; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function OptionsEditor({ label, options, onChange }: {
  label: string; options: { value: string; label: string }[]; onChange: (opts: { value: string; label: string }[]) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input type="text" value={opt.label} onChange={(e) => {
            const updated = [...options]
            updated[i] = { value: e.target.value, label: e.target.value }
            onChange(updated)
          }} className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          <button type="button" onClick={() => onChange(options.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-sm px-1" title="Remove option">&times;</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, { value: '', label: '' }])} className="text-xs text-blue-600 hover:text-blue-800 mt-1">+ Add option</button>
    </div>
  )
}
