import { cleanMergeTags } from '../types'

interface WelcomeSectionProps {
  sectionId: string
  welcome: {
    intro?: string
    tagline?: string
    summary?: string
  }
}

export default function WelcomeSection({ sectionId, welcome }: WelcomeSectionProps) {
  return (
    <div key={sectionId} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6 ring-1 ring-slate-200">
      <div className="p-6 sm:p-8">
        {/* Cover Image */}
        <div className="mb-4">
          <img
            src="/images/accounting_website/ai_accounting_daily_cover_image.jpg"
            alt="AI Accounting Daily"
            className="mx-auto max-w-full rounded-lg"
            style={{ maxHeight: '400px' }}
          />
        </div>
        <div className="space-y-3">
          <div className="text-slate-900 leading-relaxed">
            Hey, Accounting Pros!
          </div>
          {welcome.tagline && (
            <div className="text-slate-900 leading-relaxed font-bold whitespace-pre-wrap">
              {cleanMergeTags(welcome.tagline)}
            </div>
          )}
          {welcome.summary && (
            <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">
              {cleanMergeTags(welcome.summary)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
