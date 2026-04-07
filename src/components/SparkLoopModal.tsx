'use client'

import type {
  SparkLoopRecommendation,
  SparkLoopModalProps,
} from '@/types/sparkloop'
import { useSparkLoopModal } from './useSparkLoopModal'

/**
 * Individual recommendation card component
 */
function RecommendationCard({
  recommendation,
  isSelected,
  onToggle,
}: {
  recommendation: SparkLoopRecommendation
  isSelected: boolean
  onToggle: (refCode: string) => void
}) {
  return (
    <div
      className="flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => onToggle(recommendation.ref_code)}
    >
      {/* Logo */}
      <div className="flex-shrink-0">
        {recommendation.publication_logo ? (
          <img
            src={recommendation.publication_logo}
            alt={recommendation.publication_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-lg font-semibold">
              {recommendation.publication_name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 text-sm">
          {recommendation.publication_name}
        </h4>
        {recommendation.description && (
          <p className="text-gray-500 text-sm leading-snug mt-0.5">
            {recommendation.description}
          </p>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex-shrink-0">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-[#E91E8C] border-[#E91E8C]'
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * SparkLoop Upscribe Modal
 *
 * Custom-branded modal that replaces SparkLoop's embedded popup.
 * Fetches recommendations via API and submits selections server-side.
 */
export function SparkLoopModal({
  isOpen,
  onClose,
  subscriberEmail,
  onSubscribeComplete,
  publicationName = 'AI Accounting Daily',
  publicationId,
}: SparkLoopModalProps) {
  const {
    isLoading,
    error,
    recommendations,
    selectedRefCodes,
    isSubmitting,
    toggleSelection,
    handleSkip,
    handleSubscribe,
  } = useSparkLoopModal({ isOpen, subscriberEmail, publicationId, onClose, onSubscribeComplete })

  // Don't render if not open
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[716px] max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">You&apos;re subscribed!</h2>
          <p className="mt-2 text-gray-500">
            {publicationName} recommends these newsletters:
          </p>
        </div>

        {/* Content */}
        <div className="px-6 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#E91E8C]" />
            </div>
          ) : error && recommendations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{error}</p>
              <button
                onClick={handleSkip}
                className="mt-4 text-[#E91E8C] hover:underline"
              >
                Continue without selecting
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.ref_code}
                  recommendation={rec}
                  isSelected={selectedRefCodes.has(rec.ref_code)}
                  onToggle={toggleSelection}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && recommendations.length > 0 && (
          <div className="px-6 py-6 space-y-3">
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              onClick={handleSubscribe}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#E91E8C] text-white font-semibold rounded-full hover:bg-[#d11a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Subscribing...
                </span>
              ) : selectedRefCodes.size > 0 ? (
                `Subscribe to ${selectedRefCodes.size} publication${selectedRefCodes.size > 1 ? 's' : ''}`
              ) : (
                'Subscribe to these publications'
              )}
            </button>

            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
