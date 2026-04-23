'use client'

import { Container } from '@/components/salient/Container'
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'
import { useRecommendations } from './useRecommendations'

interface RecommendationsContentProps {
  logoUrl: string
  newsletterName: string
  publicationId: string
}

export function RecommendationsContent({ logoUrl, newsletterName, publicationId }: RecommendationsContentProps) {
  const {
    email, recommendations, selectedRefCodes,
    isLoading, isSubmitting, error, submitted,
    toggleSelection, goToInfo, handleSkip, handleSubscribe,
  } = useRecommendations(publicationId)

  // Missing email state
  if (!email || !email.includes('@')) {
    return (
      <section className="pt-8 sm:pt-12 pb-6 sm:pb-16">
        <Container>
          <div className="mx-auto max-w-[600px] text-center">
            <div className="flex justify-center mb-4">
              <img src={logoUrl} alt={newsletterName} className="h-20 sm:h-28 w-auto object-contain" />
            </div>
            <SubscribeProgressBar step={3} />
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Something went wrong</h1>
            <p className="mt-4 text-base text-slate-600">We couldn&apos;t find your email address. Please subscribe first.</p>
            <a href="/subscribe" className="mt-6 inline-block rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">Go to Subscribe</a>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section className="pt-8 sm:pt-12 pb-6 sm:pb-16">
      <Container>
        <div className="mx-auto max-w-[600px] text-center">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt={newsletterName} className="h-20 sm:h-28 w-auto object-contain" />
          </div>
          <SubscribeProgressBar step={3} />
          <h1 className="font-display text-xl tracking-tight text-slate-900 sm:text-2xl mb-2">Thank you for visiting {newsletterName}</h1>
          <p className="text-base text-slate-600 mb-6">Check out these recommended resources while we prepare your subscription.</p>

          <div className="mt-8 sm:mt-10">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-600" />
              </div>
            ) : submitted ? (
              <div className="py-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-900">You&apos;re all set!</p>
                <p className="mt-1 text-sm text-slate-500">Redirecting...</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="py-12">
                <p className="text-slate-600 mb-6">No additional recommendations available right now.</p>
                <button onClick={goToInfo} className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">Continue</button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 text-left">
                  {recommendations.map((rec) => (
                    <RecommendationCard key={rec.ref_code} rec={rec} selected={selectedRefCodes.has(rec.ref_code)} onToggle={() => toggleSelection(rec.ref_code)} />
                  ))}
                </div>

                {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

                <button onClick={handleSubscribe} disabled={isSubmitting} className="mt-6 w-full rounded-full bg-blue-600 py-3.5 px-4 text-base font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Subscribing...
                    </span>
                  ) : selectedRefCodes.size > 0 ? (
                    `Subscribe to ${selectedRefCodes.size} publication${selectedRefCodes.size > 1 ? 's' : ''}`
                  ) : (
                    'Continue'
                  )}
                </button>

                <button onClick={handleSkip} disabled={isSubmitting} className="mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50">Maybe later</button>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}

function RecommendationCard({ rec, selected, onToggle }: {
  rec: { ref_code: string; publication_name: string; publication_logo?: string | null; description?: string | null }
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
        selected ? 'border-2 border-blue-500 bg-blue-50/30' : 'border border-slate-200 shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex-shrink-0">
        <div className={`w-6 h-6 rounded flex items-center justify-center transition-all ${selected ? 'bg-blue-600 border-blue-600' : 'border-2 border-slate-300 bg-white'}`}>
          {selected && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        {rec.publication_logo ? (
          <img src={rec.publication_logo} alt={rec.publication_name} className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <span className="text-slate-500 text-sm font-semibold">{rec.publication_name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-900 text-sm">{rec.publication_name}</h4>
        {rec.description && <p className="text-sm text-slate-500 leading-snug mt-0.5">{rec.description}</p>}
      </div>
    </div>
  )
}
