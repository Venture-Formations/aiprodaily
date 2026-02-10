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
  cpa: number | null // Cost per acquisition in cents (e.g., 250 = $2.50)
  max_payout: number | null // Maximum payout in cents
  last_30_days_confirmation_rate: number | null // SparkLoop's 30-day RCR (0-100)
  pinned: boolean
  position: number | null
  referrals: {
    pending: number
    rejected: number
    confirmed: number
  }
  earnings: number // Total earnings in cents
  net_earnings: number // Net earnings after fees in cents
  partner_program_uuid: string
}

/**
 * Our stored recommendation with both SparkLoop data and our metrics
 */
export interface StoredSparkLoopRecommendation {
  id: string
  publication_id: string
  ref_code: string
  sparkloop_uuid: string | null
  publication_name: string
  publication_logo: string | null
  description: string | null

  // SparkLoop metadata
  type: 'free' | 'paid'
  status: 'active' | 'paused'
  cpa: number | null
  screening_period: number | null
  sparkloop_rcr: number | null // SparkLoop's 30-day confirmation rate
  pinned: boolean
  position: number | null
  max_payout: number | null
  partner_program_uuid: string | null

  // SparkLoop's referral tracking
  sparkloop_pending: number
  sparkloop_rejected: number
  sparkloop_confirmed: number
  sparkloop_earnings: number
  sparkloop_net_earnings: number

  // Our tracking metrics (legacy popup-level counters)
  impressions: number // Times shown in popup
  selections: number // Times user selected/checked
  submissions: number // Times submitted to SparkLoop
  confirms: number // Our confirmed referrals (legacy)
  rejections: number // Our rejected referrals (legacy)
  pending: number // Our pending referrals (legacy)

  // Our referral-level tracking (from sparkloop_referrals table)
  our_total_subscribes: number // Total popup subscriptions tracked
  our_confirms: number // Confirmed via webhook matching our popup
  our_rejections: number // Rejected via webhook matching our popup
  our_pending: number // Subscribed/pending, not yet confirmed/rejected

  // Our calculated rates (null until enough data)
  our_cr: number | null // Conversion Rate: submissions/impressions (null until 20+ impressions)
  our_rcr: number | null // Referral Confirmation Rate: confirms/(confirms+rejections) (null until 20+ outcomes)

  // Timestamps
  last_synced_at: string | null
  created_at: string
  updated_at: string
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
  subscriber_uuid?: string // Required for referral tracking attribution
  country_code: string // Required: ISO 3166-1 Alpha-2
  recommendations: string // Comma-separated ref_codes
  utm_source?: string
  utm_campaign?: string
}

/**
 * Subscriber object from SparkLoop API
 * POST /v2/subscribers or GET /v2/subscribers/:email
 */
export interface SparkLoopSubscriber {
  uuid: string
  email: string
  name: string | null
  created_at: string
}

/**
 * Response from POST /v2/subscribers or GET /v2/subscribers/:email
 */
export interface SparkLoopSubscriberResponse {
  subscriber: SparkLoopSubscriber
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
  | 'recommendations_not_selected'
  | 'subscriptions_submitted'
  | 'subscriptions_failed'
  | 'subscriptions_success'

/**
 * Event types for sync delta tracking (for timeframe-based RCR)
 */
export type SparkLoopSyncEventType =
  | 'sync_confirm_delta'
  | 'sync_rejection_delta'

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
