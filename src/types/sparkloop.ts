/**
 * SparkLoop Upscribe Types
 *
 * Types for the custom SparkLoop Upscribe popup implementation
 * using the SparkLoop API v2.
 */

/**
 * Recommendation object returned from SparkLoop API
 * GET /v2/upscribes/:identifier/recommendations
 */
export interface SparkLoopRecommendation {
  uuid: string
  ref_code: string
  type: 'free' | 'paid'
  status: 'active' | 'paused'
  publication_name: string
  publication_logo: string | null
  description: string | null
  cpa: number | null // Cost per acquisition (payout for paid recommendations)
  max_payout: number | null
  referral_pending_duration: number | null // Days before referral is confirmed
  // Additional fields that may be present
  pinned?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Response from GET /v2/upscribes/:identifier/recommendations
 */
export interface SparkLoopRecommendationsResponse {
  recommendations: SparkLoopRecommendation[]
  meta: {
    per_page: number
    page: number
    total_pages: number
    total_recommendations: number
  }
}

/**
 * Request to POST /v2/upscribes/:identifier/recommendations (generate)
 */
export interface SparkLoopGenerateRequest {
  country_code?: string // ISO 3166-1 Alpha-2 (e.g., 'US', 'GB')
  region_code?: string // ISO 3166-2 (e.g., 'TX', 'CA')
  limit?: number // Number of recommendations to generate
}

/**
 * Request to POST /v2/upscribes/:identifier/subscribe
 */
export interface SparkLoopSubscribeRequest {
  subscriber_email: string
  country_code: string // Required: ISO 3166-1 Alpha-2
  recommendations: string // Comma-separated ref_codes
  utm_source?: string
  utm_campaign?: string
}

/**
 * Modal state for the custom SparkLoop popup
 */
export interface SparkLoopModalState {
  isOpen: boolean
  isLoading: boolean
  error: string | null
  recommendations: SparkLoopRecommendation[]
  selectedRefCodes: Set<string>
  subscriberEmail: string
  isSubmitting: boolean
  submitSuccess: boolean
}

/**
 * Event types for tracking popup interactions
 */
export type SparkLoopPopupEventType =
  | 'popup_opened'
  | 'popup_skipped'
  | 'popup_closed'
  | 'recommendation_selected'
  | 'recommendation_deselected'
  | 'subscriptions_submitted'
  | 'subscriptions_failed'
  | 'subscriptions_success'

/**
 * Event data for tracking
 */
export interface SparkLoopPopupEvent {
  event_type: SparkLoopPopupEventType
  subscriber_email: string
  ref_codes?: string[] // For selection/subscription events
  recommendation_count?: number // Total recommendations shown
  selected_count?: number // Number selected
  error_message?: string // For failed events
  timestamp?: string
}

/**
 * Props for the SparkLoopModal component
 */
export interface SparkLoopModalProps {
  isOpen: boolean
  onClose: () => void
  subscriberEmail: string
  onSubscribeComplete: () => void
  publicationName?: string
}

/**
 * Props for individual recommendation cards
 */
export interface RecommendationCardProps {
  recommendation: SparkLoopRecommendation
  isSelected: boolean
  onToggle: (refCode: string) => void
}
