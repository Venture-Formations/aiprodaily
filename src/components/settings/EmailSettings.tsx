'use client'

import Link from 'next/link'
import { useEmailSettings } from './email-settings/useEmailSettings'
import { ScheduleSection } from './email-settings/ScheduleSection'
import { detectProviderFromPrompt, formatJSON } from './ai-prompts/utils'

export default function EmailSettings({ publicationId }: { publicationId: string }) {
  const h = useEmailSettings(publicationId)

  return (
    <div className="space-y-6">
      {/* Email Provider Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Service Provider</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose which email service provider to use for sending newsletters. Configure both providers below to enable easy switching.
        </p>
        <div className="flex items-center space-x-4">
          {(['mailerlite', 'sendgrid', 'beehiiv'] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => h.handleChange('emailProvider', provider)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                h.settings.emailProvider === provider
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span className="capitalize">{provider === 'mailerlite' ? 'MailerLite' : provider === 'sendgrid' ? 'SendGrid' : 'Beehiiv'}</span>
              </div>
              {h.settings.emailProvider === provider && (
                <div className="text-xs mt-1 text-brand-primary">Active Provider</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sender Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sender Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input type="email" value={h.settings.fromEmail} onChange={(e) => h.handleChange('fromEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
            <input type="text" value={h.settings.senderName} onChange={(e) => h.handleChange('senderName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
        </div>
      </div>

      {/* MailerLite Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${h.settings.emailProvider !== 'mailerlite' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">MailerLite Configuration</h3>
          {h.settings.emailProvider === 'mailerlite' && <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { field: 'mailerliteReviewGroupId', label: 'Review Group ID', placeholder: 'MailerLite group ID for review emails' },
            { field: 'mailerliteMainGroupId', label: 'Main Group ID', placeholder: 'MailerLite group ID for main newsletter' },
            { field: 'mailerliteSecondaryGroupId', label: 'Secondary Group ID', placeholder: 'MailerLite group ID for secondary sends' },
            { field: 'mailerliteTestGroupId', label: 'Test Group ID', placeholder: 'MailerLite group ID for test sends' },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type="text" value={(h.settings as any)[field]} onChange={(e) => h.handleChange(field, e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          ))}
        </div>
      </div>

      {/* SendGrid Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${h.settings.emailProvider !== 'sendgrid' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">SendGrid Configuration</h3>
          {h.settings.emailProvider === 'sendgrid' && <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { field: 'sendgridReviewListId', label: 'Review List ID', placeholder: 'SendGrid list ID for review emails' },
            { field: 'sendgridMainListId', label: 'Main List ID', placeholder: 'SendGrid list ID for main newsletter' },
            { field: 'sendgridSecondaryListId', label: 'Secondary List ID', placeholder: 'SendGrid list ID for secondary sends' },
            { field: 'sendgridTestListId', label: 'Test List ID', placeholder: 'SendGrid list ID for test sends' },
            { field: 'sendgridSenderId', label: 'Sender ID', placeholder: 'SendGrid verified sender ID' },
            { field: 'sendgridUnsubscribeGroupId', label: 'Unsubscribe Group ID', placeholder: 'SendGrid unsubscribe group ID' },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type="text" value={(h.settings as any)[field]} onChange={(e) => h.handleChange(field, e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          ))}
        </div>
      </div>

      {/* Beehiiv Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${h.settings.emailProvider !== 'beehiiv' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Beehiiv Configuration</h3>
          {h.settings.emailProvider === 'beehiiv' && <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publication ID</label>
            <input type="text" value={h.settings.beehiivPublicationId} onChange={(e) => h.handleChange('beehiivPublicationId', e.target.value)}
              placeholder="pub_xxxxxxxx-xxxx-xxxx" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input type="password" value={h.settings.beehiivApiKey} onChange={(e) => h.handleChange('beehiivApiKey', e.target.value)}
              placeholder={h.settings.hasBeehiivApiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022  (key saved)' : 'Enter Beehiiv API key'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            {h.settings.hasBeehiivApiKey && <p className="text-xs text-gray-500 mt-1">API key is saved. Enter a new value to replace it.</p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Beehiiv handles subscriber management only. Newsletter sending still uses MailerLite, so keep your MailerLite group IDs configured above.
        </p>
      </div>

      {/* Review Schedule */}
      <ScheduleSection
        title="Automated Publication Review Schedule"
        description="Configure the automated review workflow times (Central Time Zone)."
        enabled={h.settings.reviewScheduleEnabled}
        enabledField="reviewScheduleEnabled"
        settings={h.settings}
        onChange={h.handleChange}
        timeFields={[
          { label: 'Issue Processing Time', field: 'rssProcessingTime', hint: 'Daily issue creation and processing' },
          { label: 'Campaign Creation Time', field: 'issueCreationTime', hint: 'SendGrid campaign setup and review' },
          { label: 'Scheduled Send Time', field: 'scheduledSendTime', hint: 'Review newsletter delivery (5-minute increments)' },
        ]}
        workflowTitle="Review Workflow Overview"
        workflowColor="blue"
        workflowSteps={[
          `${h.settings.rssProcessingTime} - Create tomorrow's issue, process RSS feeds, and generate AI subject line`,
          `${h.settings.issueCreationTime} - Create review campaign and schedule for delivery`,
          `${h.settings.scheduledSendTime} - SendGrid sends review to review list only`,
        ]}
      />

      {/* Daily Schedule */}
      <ScheduleSection
        title="Automated Daily Publication Schedule"
        description="Configure the automated daily newsletter delivery times (Central Time Zone)."
        enabled={h.settings.dailyScheduleEnabled}
        enabledField="dailyScheduleEnabled"
        settings={h.settings}
        onChange={h.handleChange}
        timeFields={[
          { label: 'Campaign Creation Time', field: 'dailyissueCreationTime', hint: 'Final campaign creation with any review changes' },
          { label: 'Scheduled Send Time', field: 'dailyScheduledSendTime', hint: 'Final publication delivery to main subscriber group (5-minute increments)' },
        ]}
        workflowTitle="Daily Publication Workflow"
        workflowColor="green"
        workflowSteps={[
          `${h.settings.dailyissueCreationTime} - Create final campaign with any changes made to issue during review`,
          `${h.settings.dailyScheduledSendTime} - Send final issue to main subscriber group`,
        ]}
      />

      {/* Secondary Schedule */}
      <ScheduleSection
        title="Automated Secondary Publication Schedule"
        description="Configure secondary newsletter delivery to a different subscriber group on selected days (Central Time Zone)."
        enabled={h.settings.secondaryScheduleEnabled}
        enabledField="secondaryScheduleEnabled"
        settings={h.settings}
        onChange={h.handleChange}
        timeFields={[
          { label: 'Campaign Creation Time', field: 'secondaryissueCreationTime', hint: 'Secondary campaign creation with existing issue content' },
          { label: 'Scheduled Send Time', field: 'secondaryScheduledSendTime', hint: 'Delivery to secondary subscriber group (5-minute increments)' },
        ]}
        workflowTitle="Secondary Publication Workflow"
        workflowColor="purple"
        workflowSteps={[
          `${h.settings.secondaryissueCreationTime} - Create campaign using existing issue content`,
          `${h.settings.secondaryScheduledSendTime} - Send to secondary subscriber group (on selected days only)`,
        ]}
      >
        {/* Send Days */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Send Days</label>
          <div className="grid grid-cols-7 gap-2">
            {[{ day: 0, label: 'Sun' }, { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' }, { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }].map(({ day, label }) => (
              <label
                key={day}
                className={`flex items-center justify-center p-3 border rounded-md cursor-pointer transition-colors ${
                  h.settings.secondarySendDays.includes(day)
                    ? 'bg-brand-primary border-brand-primary text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-brand-primary'
                } ${!h.settings.secondaryScheduleEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input type="checkbox" checked={h.settings.secondarySendDays.includes(day)}
                  onChange={(e) => {
                    const days = h.settings.secondarySendDays
                    h.handleChange('secondarySendDays', e.target.checked ? [...days, day].sort() : days.filter(d => d !== day))
                  }}
                  disabled={!h.settings.secondaryScheduleEnabled} className="sr-only" />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Select the days when the secondary newsletter should be sent</p>
        </div>
      </ScheduleSection>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={h.handleSave} disabled={h.saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium">
          {h.saving ? 'Saving...' : 'Save Email & Schedule Settings'}
        </button>
      </div>

      {h.message && (
        <div className={`mt-4 p-4 rounded-md ${h.message.includes('successfully') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {h.message}
        </div>
      )}

      {/* Deduplication Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Deduplication Settings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure how the system detects and prevents duplicate articles from appearing in your newsletters. The system uses a 4-stage detection process: historical checking, exact content matching, title similarity, and AI semantic analysis.
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Historical Lookback Days:</label>
            <input type="number" min="1" max="14" value={h.dedupLookbackDays} onChange={(e) => h.setDedupLookbackDays(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md" disabled={h.savingDedupSettings} />
            <span className="text-sm text-gray-500">(1-14 days)</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Strictness Threshold:</label>
            <input type="number" min="0.5" max="1.0" step="0.05" value={h.dedupStrictnessThreshold} onChange={(e) => h.setDedupStrictnessThreshold(parseFloat(e.target.value) || 0.8)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md" disabled={h.savingDedupSettings} />
            <span className="text-sm text-gray-500">(0.5-1.0, lower = stricter)</span>
          </div>
          <button onClick={h.saveDedupSettings} disabled={h.savingDedupSettings}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300">
            {h.savingDedupSettings ? 'Saving...' : 'Save Deduplication Settings'}
          </button>
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> Checking {h.dedupLookbackDays} days of past newsletters with {Math.round(h.dedupStrictnessThreshold * 100)}% similarity threshold
          </p>
          <p className="text-xs text-blue-700 mt-2">
            <strong>How it works:</strong> Stage 1 checks against articles used in the last {h.dedupLookbackDays} sent newsletters. Stages 2-4 check exact content matches (100% similarity), title similarity (&gt;{Math.round(h.dedupStrictnessThreshold * 100)}%), and AI semantic analysis (&gt;{Math.round(h.dedupStrictnessThreshold * 100)}%) within the current issue&apos;s articles.
          </p>
        </div>
      </div>

      {/* Subject Line AI Prompt */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-gray-900">Subject Line Generator</h3>
                {h.subjectLinePromptOriginal && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    detectProviderFromPrompt(h.editingSubjectLine ? h.subjectLinePrompt : h.subjectLinePromptOriginal) === 'claude'
                      ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {detectProviderFromPrompt(h.editingSubjectLine ? h.subjectLinePrompt : h.subjectLinePromptOriginal) === 'claude' ? 'Claude' : 'OpenAI'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">Configure the AI prompt used to generate engaging subject lines for your newsletters.</p>
            </div>
            <button onClick={() => h.setExpandedSubjectLine(!h.expandedSubjectLine)} className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium">
              {h.expandedSubjectLine ? 'Collapse' : 'View/Edit'}
            </button>
          </div>
        </div>

        {h.expandedSubjectLine && (
          <div className="p-6">
            {!h.subjectLinePromptOriginal ? (
              <div className="text-gray-500 italic">Loading prompt...</div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Prompt Content</label>
                  <span className="text-xs text-gray-500">{h.editingSubjectLine ? h.subjectLinePrompt.length : h.subjectLinePromptOriginal.length} characters</span>
                </div>
                {h.editingSubjectLine ? (
                  <>
                    <textarea value={h.subjectLinePrompt} onChange={(e) => h.setSubjectLinePrompt(e.target.value)} rows={15}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                      <span className="font-medium">Expected Response:</span>{' '}
                      <code className="bg-amber-100 px-1 rounded">Plain text (max 40 characters)</code>
                    </p>
                    <div className="mt-3 flex items-center justify-end space-x-3">
                      <button onClick={h.handleCancelSubjectLine} disabled={h.savingSubjectLine}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                      <button onClick={h.saveSubjectLinePrompt} disabled={h.savingSubjectLine}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                        {h.savingSubjectLine ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex items-center">
                      <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={h.prettyPrintSubjectLine} onChange={(e) => h.setPrettyPrintSubjectLine(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                        Pretty-print
                      </label>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                      {formatJSON(h.subjectLinePromptOriginal, h.prettyPrintSubjectLine)}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button onClick={h.handleResetSubjectLine} disabled={h.savingSubjectLine}
                          className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50">
                          {h.savingSubjectLine ? 'Resetting...' : 'Reset to Default'}
                        </button>
                        <button onClick={h.handleSaveAsDefaultSubjectLine} disabled={h.savingSubjectLine}
                          className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50">
                          {h.savingSubjectLine ? 'Saving...' : 'Save as Default'}
                        </button>
                      </div>
                      <button onClick={h.handleEditSubjectLine}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit Prompt</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Testing Playground */}
      {h.newsletterSlug && (
        <div className="flex justify-center">
          <Link href={`/dashboard/${h.newsletterSlug}/settings/AIPromptTesting`}
            className="px-6 py-3 text-base font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg">
            AI Testing Playground
          </Link>
        </div>
      )}
    </div>
  )
}
