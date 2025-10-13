export type CampaignStatus = 'draft' | 'in_review' | 'changes_made' | 'sent' | 'failed'
export type UserRole = 'admin' | 'reviewer'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface NewsletterCampaign {
  id: string
  date: string
  status: CampaignStatus
  subject_line: string | null
  review_sent_at: string | null
  final_sent_at: string | null
  last_action: 'changes_made' | 'approved' | null
  last_action_at: string | null
  last_action_by: string | null
  status_before_send: CampaignStatus | null
  metrics: Record<string, any>
  created_at: string
  updated_at: string
}

export interface RssFeed {
  id: string
  url: string
  name: string
  active: boolean
  last_processed: string | null
  processing_errors: number
  created_at: string
  updated_at: string
}

export interface RssPost {
  id: string
  feed_id: string
  campaign_id: string
  external_id: string
  title: string
  description: string | null
  content: string | null
  author: string | null
  publication_date: string | null
  source_url: string | null
  image_url: string | null
  processed_at: string
}

export interface PostRating {
  id: string
  post_id: string
  interest_level: number
  local_relevance: number
  community_impact: number
  total_score: number
  ai_reasoning: string | null
  created_at: string
}

export interface Article {
  id: string
  post_id: string
  campaign_id: string
  headline: string
  content: string
  rank: number | null
  is_active: boolean
  skipped: boolean
  fact_check_score: number | null
  fact_check_details: string | null
  word_count: number | null
  review_position: number | null
  final_position: number | null
  created_at: string
  updated_at: string
}

export interface ManualArticle {
  id: string
  campaign_id: string
  title: string
  content: string
  image_url: string | null
  source_url: string | null
  rank: number | null
  is_active: boolean
  review_position: number | null
  final_position: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ArchivedArticle {
  id: string
  original_article_id: string
  post_id: string | null
  campaign_id: string
  headline: string
  content: string
  rank: number | null
  is_active: boolean
  skipped: boolean
  fact_check_score: number | null
  fact_check_details: string | null
  word_count: number | null
  review_position: number | null
  final_position: number | null
  archived_at: string
  archive_reason: string
  campaign_date: string | null
  campaign_status: string | null
  original_created_at: string
  original_updated_at: string
  created_at: string
}

export interface ArchivedRssPost {
  id: string
  original_post_id: string
  feed_id: string
  campaign_id: string
  external_id: string
  title: string
  description: string | null
  content: string | null
  author: string | null
  publication_date: string | null
  source_url: string | null
  image_url: string | null
  processed_at: string
  archived_at: string
  archive_reason: string
  campaign_date: string | null
  created_at: string
}

export interface ArchivedPostRating {
  id: string
  original_rating_id: string
  archived_post_id: string
  interest_level: number
  local_relevance: number
  community_impact: number
  total_score: number
  ai_reasoning: string | null
  archived_at: string
  original_created_at: string
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  last_login: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SystemLog {
  id: string
  level: LogLevel
  message: string
  context: Record<string, any>
  source: string | null
  timestamp: string
}

export interface DuplicateGroup {
  id: string
  campaign_id: string
  primary_post_id: string
  topic_signature: string
  created_at: string
}

export interface DuplicatePost {
  id: string
  group_id: string
  post_id: string
  similarity_score: number
}

export interface EmailMetrics {
  id: string
  campaign_id: string
  mailerlite_campaign_id: string | null
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  unsubscribed_count: number
  open_rate: number | null
  click_rate: number | null
  bounce_rate: number | null
  unsubscribe_rate: number | null
  imported_at: string
}

export interface ArticlePerformance {
  id: string
  article_id: string
  click_count: number
  engagement_score: number | null
  feedback_positive: number
  feedback_negative: number
  created_at: string
}

export interface UserActivity {
  id: string
  user_id: string
  campaign_id: string
  action: string
  details: Record<string, any>
  timestamp: string
}

export interface AppSetting {
  id: string
  key: string
  value: string | null
  description: string | null
  updated_by: string | null
  updated_at: string
}

export interface LinkClick {
  id: string
  campaign_date: string
  campaign_id: string | null
  subscriber_email: string
  subscriber_id: string | null
  link_url: string
  link_section: string
  clicked_at: string
  user_agent: string | null
  ip_address: string | null
  created_at: string
}

export interface Poll {
  id: string
  title: string
  question: string
  options: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PollResponse {
  id: string
  poll_id: string
  campaign_id: string | null
  subscriber_email: string
  selected_option: string
  responded_at: string
}

// Combined types for API responses
export interface ArticleWithPost extends Article {
  rss_post: RssPost & {
    post_rating: PostRating[]
    rss_feed: RssFeed
  }
}

// Local Events types
export interface Event {
  id: string
  external_id: string
  title: string
  description: string | null
  event_summary: string | null
  start_date: string
  end_date: string | null
  venue: string | null
  address: string | null
  url: string | null
  website: string | null
  image_url: string | null
  original_image_url: string | null
  cropped_image_url: string | null
  featured: boolean
  paid_placement: boolean
  active: boolean
  submission_status: 'pending' | 'approved' | 'rejected'
  payment_status: string | null
  payment_intent_id: string | null
  payment_amount: number | null
  submitter_name: string | null
  submitter_email: string | null
  submitter_phone: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  raw_data: any
  created_at: string
  updated_at: string
}

export interface PendingEventSubmission {
  id: string
  stripe_session_id: string
  events_data: any[]
  submitter_email: string
  submitter_name: string
  total_amount: number
  created_at: string
  expires_at: string
  processed: boolean
  processed_at: string | null
}

export interface WeatherForecast {
  id: string
  forecast_date: string
  generated_at: string
  weather_data: {
    day: string
    dateLabel: string
    icon: string
    precipitation: number
    high: number
    low: number
    condition: string
  }[]
  html_content: string
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Normalized road work item (now stored in separate table rows)
export interface RoadWorkItem {
  id: string
  campaign_id: string
  road_name: string
  road_range: string | null
  city_or_township: string | null
  reason: string | null
  start_date: string | null
  expected_reopen: string | null
  source_url: string | null
  display_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Legacy interface for backward compatibility (deprecated)
export interface RoadWorkData {
  id: string
  campaign_id: string
  generated_at: string
  road_work_data: Array<{
    road_name: string
    road_range: string | null
    city_or_township: string | null
    reason: string | null
    start_date: string | null
    expected_reopen: string | null
    source_url: string | null
  }>
  html_content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignEvent {
  id: string
  campaign_id: string
  event_id: string
  event_date: string
  is_selected: boolean
  is_featured: boolean
  display_order: number | null
  created_at: string
  event?: Event
}

export interface NewsletterSection {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface CampaignWithArticles extends NewsletterCampaign {
  articles: ArticleWithPost[]
  manual_articles: ManualArticle[]
  email_metrics: EmailMetrics | null
}

export interface CampaignWithEvents extends CampaignWithArticles {
  campaign_events: CampaignEvent[]
}

// AI Processing types
export interface ContentEvaluation {
  interest_level: number
  local_relevance: number
  community_impact: number
  reasoning: string
}

export interface NewsletterContent {
  headline: string
  content: string
  word_count: number
}

export interface FactCheckResult {
  score: number
  details: string
  passed: boolean
}

export interface SubjectLineGeneration {
  subject_line: string
  character_count: number
}

export interface Wordle {
  id: string
  date: string  // YYYY-MM-DD format
  word: string
  definition: string
  interesting_fact: string
  created_at: string
  updated_at: string
}

export interface VrboListing {
  id: string
  title: string
  main_image_url: string | null
  adjusted_image_url: string | null  // GitHub hosted resized image URL
  city: string | null
  bedrooms: number | null
  bathrooms: number | null
  sleeps: number | null
  link: string  // Tracked affiliate link
  non_tracked_link: string | null  // Original VRBO link
  listing_type: 'Local' | 'Greater'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignVrboSelection {
  id: string
  campaign_id: string
  listing_id: string
  selection_order: number  // 1, 2, 3 for display order
  created_at: string
  listing?: VrboListing
}

export interface VrboSelectionState {
  id: string
  listing_type: 'Local' | 'Greater'
  current_index: number
  shuffle_order: string[]  // Array of listing IDs in shuffled order
  last_updated: string
}

export interface DiningDeal {
  id: string
  business_name: string
  business_address: string | null
  google_profile: string | null  // Google Maps URL
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  special_description: string  // Max 65 characters
  special_time: string | null  // e.g., "11AM - 3PM", "All day", etc.
  is_featured: boolean
  paid_placement: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignDiningSelection {
  id: string
  campaign_id: string
  deal_id: string
  selection_order: number  // 1-8 for display order
  is_featured_in_campaign: boolean  // Whether this deal is featured in this campaign
  created_at: string
  deal?: DiningDeal
}

// Images Database types
export interface ImageTag {
  type: 'people' | 'scene' | 'theme' | 'style' | 'color' | 'object' | 'safety'
  name: string
  conf: number
}

export interface OCREntity {
  type: 'ORG' | 'PERSON' | 'LOC' | 'DATE' | 'TIME' | 'MISC'
  name: string
  conf: number
}

export interface AgeGroupDetection {
  age_group: 'preschool' | 'elementary' | 'high_school' | 'adult' | 'older_adult'
  count: number
  conf: number
}

export interface Image {
  id: string
  object_key: string                    // images/original/{uuid}.jpg
  cdn_url: string                       // Auto-generated Supabase CDN URL
  width: number | null
  height: number | null
  aspect_ratio: number | null
  orientation: 'landscape' | 'portrait' | 'square' | null
  source_url: string | null
  license: string | null
  credit: string | null
  city: string | null                   // Changed from location to city
  source: string | null                 // New field for source
  original_file_name: string | null     // New field for original file name
  faces_count: number
  has_text: boolean
  dominant_colors: string[] | null
  safe_score: number | null
  ocr_text: string | null              // Full OCR'd text (lowercased, normalized)
  text_density: number | null          // Percent of pixels covered by text (0-1)
  ocr_entities: OCREntity[] | null     // Extracted entities from OCR (NER)
  signage_conf: number | null          // Confidence it's venue signage vs poster/ad
  age_groups: AgeGroupDetection[] | null // Detected age groups of people in image
  ai_caption: string | null
  ai_alt_text: string | null
  ai_tags: string[] | null
  ai_tags_scored: ImageTag[] | null
  emb_caption: number[] | null          // Vector embedding
  crop_ratio: string                    // Default '16:9'
  crop_v_offset: number                 // 0-1, default 0.5
  variant_16x9_key: string | null
  variant_16x9_url: string | null
  created_at: string
  updated_at: string
}

export interface ImageVariant {
  id: string
  image_id: string
  variant_type: string                  // '16:9', '1:1', '4:3', etc.
  width: number
  height: number
  object_key: string
  cdn_url: string                       // Auto-generated Supabase CDN URL
  github_url: string | null
  crop_v_offset: number
  crop_h_offset: number
  created_at: string
}

export interface ArticleImageChoice {
  id: string
  article_id: string
  image_id: string
  choice_reason: 'ai_matched' | 'manual_selection' | 'fallback'
  confidence_score: number | null
  created_at: string
  image?: Image
}

// Image upload and processing types
export interface ImageUploadRequest {
  filename: string
  content_type: string
  size: number
}

export interface ImageUploadResponse {
  upload_url: string
  object_key: string
  image_id: string
}

export interface ImageAnalysisResult {
  caption: string
  alt_text: string
  tags_scored: ImageTag[]
  top_tags: string[]
  width: number
  height: number
  aspect_ratio: number
  orientation: 'landscape' | 'portrait' | 'square'
  faces_count: number
  has_text: boolean
  dominant_colors: string[]
  safe_score: number
  variant_16x9_url?: string | null
  ocr_text: string | null
  text_density: number | null
  ocr_entities: OCREntity[] | null
  signage_conf: number | null
  age_groups: AgeGroupDetection[] | null
}

export interface ImageReviewRequest {
  image_id: string
  ai_caption?: string
  ai_alt_text?: string
  ai_tags?: string[]
  ai_tags_scored?: ImageTag[]
  license?: string
  credit?: string
  city?: string
  source?: string
  original_file_name?: string
  crop_v_offset?: number
  source_url?: string
}

export interface ImageSearchFilters {
  text_search?: string
  tags?: string[]
  orientation?: 'landscape' | 'portrait' | 'square'
  date_from?: string
  date_to?: string
  license?: string
  has_faces?: boolean
  has_text?: boolean
  limit?: number
  offset?: number
}

// Advertisement types
export type AdFrequency = 'single' | 'weekly' | 'monthly'
export type AdStatus = 'pending_payment' | 'pending_review' | 'approved' | 'active' | 'completed' | 'rejected'

export interface Advertisement {
  id: string
  title: string
  body: string  // Rich text HTML
  word_count: number
  business_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  business_address: string | null
  business_website: string | null
  image_url: string | null  // Optional cropped image (5:4 ratio)
  frequency: AdFrequency
  times_paid: number
  times_used: number
  status: AdStatus
  display_order: number | null  // Position in rotation queue (only for active ads)
  paid: boolean  // Whether the ad has been paid for (bypasses payment processing)
  preferred_start_date: string | null
  actual_start_date: string | null
  last_used_date: string | null
  payment_intent_id: string | null
  payment_amount: number | null
  payment_status: string | null
  submission_date: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface CampaignAdvertisement {
  id: string
  campaign_id: string  // UUID stored as string in TypeScript
  advertisement_id: string  // UUID stored as string in TypeScript
  campaign_date: string
  used_at: string
  created_at: string
  advertisement?: Advertisement
}

export interface AdPricingTier {
  id: string
  frequency: AdFrequency
  min_quantity: number
  max_quantity: number | null
  price_per_unit: number
  created_at: string
  updated_at: string
}