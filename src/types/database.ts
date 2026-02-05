export type IssueStatus = 'draft' | 'in_review' | 'changes_made' | 'sent' | 'failed' | 'processing'
export type UserRole = 'admin' | 'reviewer'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// Deprecated aliases for backward compatibility during migration
/** @deprecated Use IssueStatus instead */
export type CampaignStatus = IssueStatus

// Multi-Tenant Newsletter Interfaces
export interface Newsletter {
  id: string
  slug: string
  name: string
  subdomain: string
  website_domain: string | null
  description: string | null
  logo_url: string | null
  primary_color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PublicationSetting {
  id: string
  publication_id: string
  key: string
  value: string | null
  custom_default: string | null
  description: string | null
  updated_by: string | null
  updated_at: string
  created_at: string
}

/** @deprecated Use PublicationSetting instead */
export type NewsletterSetting = PublicationSetting

// AI Professional Newsletter Features
export type ToolType = 'Client' | 'Firm'
export type AIAppCategory = 'Accounting & Bookkeeping' | 'Tax & Compliance' | 'Payroll' | 'Finance & Analysis' | 'Expense Management' | 'Client Management' | 'Productivity' | 'HR' | 'Banking & Payments'

export type AIAppSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'edited'
export type AIAppPlan = 'free' | 'monthly' | 'yearly'

export interface AIApplication {
  id: string
  publication_id: string
  app_name: string
  tagline: string | null
  description: string
  category: AIAppCategory | null
  app_url: string
  tracked_link: string | null
  logo_url: string | null
  screenshot_url: string | null
  tool_type: ToolType | null
  category_priority: number
  is_featured: boolean
  is_paid_placement: boolean
  is_affiliate: boolean
  is_active: boolean
  display_order: number | null
  last_used_date: string | null
  times_used: number
  created_at: string
  updated_at: string

  // Submission info
  clerk_user_id: string | null
  submitter_email: string | null
  submitter_name: string | null
  submitter_image_url: string | null

  // Status and moderation
  submission_status: AIAppSubmissionStatus
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null

  // Sponsorship/Payment
  plan: AIAppPlan
  stripe_payment_id: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  sponsor_start_date: string | null
  sponsor_end_date: string | null

  // Analytics
  view_count: number
  click_count: number

  // Module assignment (for AI App Modules system)
  ai_app_module_id: string | null  // Links to ai_app_modules. NULL = available for any module
  priority: number  // Higher priority = selected first in affiliate_priority mode

  // Pinning (Product Cards)
  pinned_position: number | null  // 1-based position for globally pinned apps. NULL = not pinned.
}

export interface IssueAIAppSelection {
  id: string
  issue_id: string
  app_id: string
  selection_order: number
  is_featured: boolean
  created_at: string
  app?: AIApplication
}

/** @deprecated Use IssueAIAppSelection instead */
export type issueAIAppSelection = IssueAIAppSelection

export interface PromptIdea {
  id: string
  publication_id: string
  title: string
  prompt_text: string
  category: string | null
  use_case: string | null
  suggested_model: string | null
  difficulty_level: string | null
  estimated_time: string | null
  is_featured: boolean
  is_active: boolean
  display_order: number | null
  last_used_date: string | null
  times_used: number
  // Module system fields
  prompt_module_id: string | null
  priority: number
  created_at: string
  updated_at: string
}

export interface IssuePromptSelection {
  id: string
  issue_id: string
  prompt_id: string
  selection_order: number
  is_featured: boolean
  created_at: string
  prompt?: PromptIdea
}

/** @deprecated Use IssuePromptSelection instead */
export type issuePromptSelection = IssuePromptSelection

export interface PublicationIssue {
  id: string
  publication_id: string
  date: string
  status: IssueStatus
  subject_line: string | null
  welcome_intro: string | null
  welcome_tagline: string | null
  welcome_summary: string | null
  review_sent_at: string | null
  final_sent_at: string | null
  last_action: 'changes_made' | 'approved' | null
  last_action_at: string | null
  last_action_by: string | null
  status_before_send: IssueStatus | null
  metrics: Record<string, any>
  workflow_state: string | null
  workflow_state_started_at: string | null
  workflow_error: string | null
  poll_id: string | null
  poll_snapshot: {
    id: string
    title: string
    question: string
    options: string[]
  } | null
  mailerlite_issue_id: string | null
  created_at: string
  updated_at: string
}

/** @deprecated Use PublicationIssue instead */
export type Newsletterissue = PublicationIssue

/** @deprecated Use PublicationIssue instead */
export type NewsletterCampaign = PublicationIssue

export interface ArchivedNewsletter {
  id: string
  issue_id: string
  publication_id: string
  issue_date: string  // Date in YYYY-MM-DD format for URL
  subject_line: string
  send_date: string  // Timestamp when sent
  recipient_count: number
  html_backup: string | null  // Full HTML for backup/reference
  metadata: Record<string, any>  // Issue metadata (settings, etc)
  articles: any[]  // Array of article data with full content
  secondary_articles?: any[]  // Array of secondary article data
  events: any[]  // Array of event data
  sections: Record<string, any>  // All newsletter sections data
  created_at: string
  updated_at: string
}

export interface RssFeed {
  id: string
  publication_id: string | null
  url: string
  name: string
  description: string | null
  active: boolean
  use_for_primary_section: boolean
  use_for_secondary_section: boolean
  article_module_id: string | null
  last_processed: string | null
  last_error: string | null
  processing_errors: number
  created_at: string
  updated_at: string
}

// Extraction status types for paywall/access detection
export type ExtractionStatus = 'pending' | 'success' | 'paywall' | 'login_required' | 'blocked' | 'timeout' | 'failed'

export interface RssPost {
  id: string
  feed_id: string
  issue_id: string
  article_module_id: string | null
  external_id: string
  title: string
  description: string | null
  content: string | null
  full_article_text: string | null
  author: string | null
  publication_date: string | null
  source_url: string | null
  image_url: string | null
  processed_at: string
  breaking_news_score: number | null
  breaking_news_category: string | null
  ai_summary: string | null
  ai_title: string | null
  // Extraction status tracking (paywall/access detection)
  extraction_status: ExtractionStatus | null
  extraction_error: string | null
  // Multi-criteria scoring system (expandable 1-5 criteria)
  criteria_1_score: number | null
  criteria_1_reason: string | null
  criteria_2_score: number | null
  criteria_2_reason: string | null
  criteria_3_score: number | null
  criteria_3_reason: string | null
  criteria_4_score: number | null
  criteria_4_reason: string | null
  criteria_5_score: number | null
  criteria_5_reason: string | null
  final_priority_score: number | null
  criteria_enabled: number | null
}

export interface PostRating {
  id: string
  post_id: string
  interest_level: number
  local_relevance: number
  community_impact: number
  total_score: number
  ai_reasoning: string | null
  // Multi-criteria scoring system (expandable 1-5 criteria)
  criteria_1_score?: number | null
  criteria_1_reason?: string | null
  criteria_1_weight?: number | null
  criteria_2_score?: number | null
  criteria_2_reason?: string | null
  criteria_2_weight?: number | null
  criteria_3_score?: number | null
  criteria_3_reason?: string | null
  criteria_3_weight?: number | null
  criteria_4_score?: number | null
  criteria_4_reason?: string | null
  criteria_4_weight?: number | null
  criteria_5_score?: number | null
  criteria_5_reason?: string | null
  criteria_5_weight?: number | null
  created_at: string
}

export interface Article {
  id: string
  post_id: string
  issue_id: string
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
  breaking_news_score: number | null
  breaking_news_category: string | null
  ai_summary: string | null
  ai_title: string | null
  created_at: string
  updated_at: string
}

export interface SecondaryArticle {
  id: string
  post_id: string
  issue_id: string
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
  breaking_news_score: number | null
  breaking_news_category: string | null
  ai_summary: string | null
  ai_title: string | null
  created_at: string
  updated_at: string
}

export interface ArchivedSecondaryArticle {
  id: string
  original_article_id: string
  post_id: string | null
  issue_id: string
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
  issue_date: string | null
  issue_status: string | null
  original_created_at: string
  original_updated_at: string
  created_at: string
}

export interface ManualArticle {
  id: string
  issue_id: string
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

// Manual Articles System (for /news pages)
export type ManualArticleStatus = 'draft' | 'published' | 'used'

export interface ArticleCategory {
  id: string
  publication_id: string
  name: string
  slug: string
  created_at: string
}

export interface NewsArticle {
  id: string
  publication_id: string
  title: string
  slug: string
  body: string
  image_url: string | null
  section_type: 'primary_articles' | 'secondary_articles'
  category_id: string | null
  category?: ArticleCategory
  publish_date: string
  status: ManualArticleStatus
  used_in_issue_id: string | null
  used_at: string | null
  created_at: string
  updated_at: string
}

export interface ArchivedArticle {
  id: string
  original_article_id: string
  post_id: string | null
  issue_id: string
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
  issue_date: string | null
  issue_status: string | null
  original_created_at: string
  original_updated_at: string
  created_at: string
}

export interface ArchivedRssPost {
  id: string
  original_post_id: string
  feed_id: string
  issue_id: string
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
  issue_date: string | null
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
  issue_id: string
  primary_post_id: string
  topic_signature: string
  created_at: string
}

export interface DuplicatePost {
  id: string
  group_id: string
  post_id: string
  similarity_score: number
  detection_method?: 'historical_match' | 'content_hash' | 'title_similarity' | 'ai_semantic'
  actual_similarity_score?: number
}

export interface EmailMetrics {
  id: string
  issue_id: string
  mailerlite_issue_id: string | null  // Legacy: MailerLite campaign ID (pre-migration)
  sendgrid_singlesend_id: string | null  // New: SendGrid Single Send ID (post-migration)
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
  issue_id: string
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
  issue_date: string
  issue_id: string | null
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
  publication_id: string
  title: string
  question: string
  options: string[]
  image_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PollResponse {
  id: string
  poll_id: string
  publication_id: string
  issue_id: string | null
  subscriber_email: string
  selected_option: string
  responded_at: string
}

// Poll Module Types
export type PollBlockType = 'title' | 'question' | 'image' | 'options'

export interface PollModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  block_order: PollBlockType[]
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PollSnapshot {
  id: string
  title: string
  question: string
  options: string[]
  image_url?: string
}

export interface IssuePollModule {
  id: string
  issue_id: string
  poll_module_id: string
  poll_id: string | null
  poll_snapshot: PollSnapshot | null
  selected_at: string
  used_at: string | null
  // Joined relations
  poll_module?: PollModule
  poll?: Poll
}

// AI App Module Types (Product Cards)
export type AIAppBlockType = 'title' | 'logo' | 'image' | 'tagline' | 'description' | 'button'

export type AIAppSelectionMode = 'affiliate_priority' | 'random' | 'manual'

// Product Card Layout Settings
export type ProductCardLayoutMode = 'stacked' | 'inline'
export type ProductCardLogoStyle = 'round' | 'square'
export type ProductCardTextSize = 'small' | 'medium' | 'large'
export type ProductCardLogoPosition = 'left' | 'right' | 'inline'

// Per-block configuration for Product Cards
export interface ProductCardBlockConfig {
  logo?: {
    enabled: boolean
    style: ProductCardLogoStyle
    position: ProductCardLogoPosition
  }
  title?: {
    enabled: boolean
    size: ProductCardTextSize
  }
  description?: {
    enabled: boolean
    size: ProductCardTextSize
  }
  tagline?: {
    enabled: boolean
    size: ProductCardTextSize
  }
  image?: {
    enabled: boolean
  }
  button?: {
    enabled: boolean
  }
}

export interface AIAppModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: AIAppSelectionMode
  block_order: AIAppBlockType[]
  config: Record<string, unknown>
  // Module-specific settings
  apps_count: number
  max_per_category: number
  affiliate_cooldown_days: number
  next_position: number
  // Layout settings (Product Cards)
  layout_mode: ProductCardLayoutMode
  logo_style: ProductCardLogoStyle
  title_size: ProductCardTextSize
  description_size: ProductCardTextSize
  // Per-block configuration (Product Cards)
  block_config: ProductCardBlockConfig
  // Directory visibility
  show_in_directory: boolean  // Whether apps in this module appear in the public /tools directory
  // Display settings
  show_emoji: boolean  // Whether to display category-based emoji icons
  show_numbers: boolean  // Whether to display numbered list (1. 2. 3.)
  created_at: string
  updated_at: string
}

export interface IssueAIAppModule {
  id: string
  issue_id: string
  ai_app_module_id: string
  app_ids: string[]  // Array of selected app IDs
  selection_mode?: AIAppSelectionMode
  selected_at: string
  used_at: string | null
  // Per-issue pinning overrides (Product Cards)
  pinned_overrides: Record<string, number | null>  // {"app_id": position|null}. null = explicit unpin for this issue.
  // Joined relations
  ai_app_module?: AIAppModule
  apps?: AIApplication[]
}

export interface AIAppModuleWithApps extends AIAppModule {
  apps: AIApplication[]  // Apps assigned to or selected for this module
  app_count?: number
}

export interface IssueAIAppModuleWithDetails extends IssueAIAppModule {
  ai_app_module: AIAppModule
  apps: AIApplication[]  // The selected apps
}

// Prompt Module Types
export type PromptBlockType = 'title' | 'body'

export type PromptSelectionMode = 'sequential' | 'random' | 'priority' | 'manual'

export interface PromptModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: PromptSelectionMode
  block_order: PromptBlockType[]
  config: Record<string, unknown>
  next_position: number
  created_at: string
  updated_at: string
}

export interface IssuePromptModule {
  id: string
  issue_id: string
  prompt_module_id: string
  prompt_id: string | null
  selection_mode?: PromptSelectionMode
  selected_at: string
  used_at: string | null
  // Joined relations
  prompt_module?: PromptModule
  prompt?: PromptIdea | null
}

export interface IssuePromptModuleWithDetails extends IssuePromptModule {
  prompt_module: PromptModule
  prompt: PromptIdea | null
}

// Combined types for API responses
export interface ArticleWithPost extends Article {
  rss_post: RssPost & {
    post_rating: PostRating[]
    rss_feed: RssFeed
  }
}

export interface SecondaryArticleWithPost extends SecondaryArticle {
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

// Normalized road work item (now stored in separate table rows)
export interface RoadWorkItem {
  id: string
  issue_id: string
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
  issue_id: string
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

export interface IssueEvent {
  id: string
  issue_id: string
  event_id: string
  event_date: string
  is_selected: boolean
  is_featured: boolean
  display_order: number | null
  created_at: string
  event?: Event
}

/** @deprecated Use IssueEvent instead */
export type issueEvent = IssueEvent

export type SectionType =
  | 'primary_articles'
  | 'secondary_articles'
  | 'welcome'
  | 'ai_applications'
  | 'prompt_ideas'
  | 'advertorial'
  | 'poll'
  | 'breaking_news'
  | 'beyond_the_feed'
  | 'custom'

export interface NewsletterSection {
  id: string
  name: string
  display_order: number
  is_active: boolean
  section_type?: SectionType
  created_at: string
}

export interface IssueWithArticles extends PublicationIssue {
  articles: ArticleWithPost[]
  secondary_articles: SecondaryArticleWithPost[]
  manual_articles: ManualArticle[]
  email_metrics: EmailMetrics | null
}

export interface IssueWithEvents extends IssueWithArticles {
  issue_events: IssueEvent[]
}

/** @deprecated Use IssueWithArticles instead */
export type issueWithArticles = IssueWithArticles

/** @deprecated Use IssueWithEvents instead */
export type issueWithEvents = IssueWithEvents

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

export interface IssueVrboSelection {
  id: string
  issue_id: string
  listing_id: string
  selection_order: number  // 1, 2, 3 for display order
  created_at: string
  listing?: VrboListing
}

/** @deprecated Use IssueVrboSelection instead */
export type issueVrboSelection = IssueVrboSelection

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

export interface IssueDiningSelection {
  id: string
  issue_id: string
  deal_id: string
  selection_order: number  // 1-8 for display order
  is_featured_in_issue: boolean  // Whether this deal is featured in this issue
  created_at: string
  deal?: DiningDeal
}

/** @deprecated Use IssueDiningSelection instead */
export type issueDiningSelection = IssueDiningSelection

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
export type AdStatus = 'pending_payment' | 'pending_review' | 'in_progress' | 'awaiting_approval' | 'approved' | 'active' | 'completed' | 'rejected'

export interface Advertisement {
  id: string
  title: string
  body: string  // Rich text HTML
  word_count: number
  button_text: string
  button_url: string
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
  // Customer portal fields
  clerk_user_id: string | null  // Links ad to customer account
  company_name: string | null   // Advertiser company/product name
  ad_type: string | null        // 'main_sponsor', 'sidebar', 'footer', etc.
  preview_image_url: string | null  // Admin-created preview for customer approval
  // Ad modules integration
  ad_module_id: string | null   // Links ad to a specific ad module/section. NULL = legacy advertorial.
  advertiser_id: string | null  // Links ad to an advertiser for company-level cooldown tracking
  priority: number              // Priority for selection mode (higher = shown first)
}

export interface IssueAdvertisement {
  id: string
  issue_id: string  // UUID stored as string in TypeScript
  advertisement_id: string  // UUID stored as string in TypeScript
  issue_date: string
  used_at: string | null  // NULL until newsletter is sent, set by AdScheduler.recordAdUsage()
  created_at: string
  advertisement?: Advertisement
}

/** @deprecated Use IssueAdvertisement instead */
export type issueAdvertisement = IssueAdvertisement

export interface AdPricingTier {
  id: string
  frequency: AdFrequency
  min_quantity: number
  max_quantity: number | null
  price_per_unit: number
  created_at: string
  updated_at: string
}

// ============================================
// AI Tools Directory Types
// ============================================

export type DirectoryToolStatus = 'pending' | 'approved' | 'rejected' | 'edited'
export type DirectoryPlan = 'free' | 'monthly' | 'yearly'

export interface DirectoryCategory {
  id: string
  publication_id: string
  name: string
  description: string | null
  slug: string
  image_url: string | null
  status: DirectoryToolStatus
  display_order: number
  created_at: string
  updated_at: string
}

export interface DirectoryTool {
  id: string
  publication_id: string

  // Core tool info
  tool_name: string
  tagline: string | null
  description: string
  website_url: string

  // Images
  logo_url: string | null
  screenshot_url: string | null
  tool_image_url: string | null
  logo_image_url: string | null

  // Submission info
  clerk_user_id: string | null
  submitter_email: string | null
  submitter_name: string | null
  submitter_image_url: string | null

  // Status and moderation
  status: DirectoryToolStatus
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null

  // Sponsorship/Payment
  is_sponsored: boolean
  plan: DirectoryPlan
  stripe_payment_id: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  sponsor_start_date: string | null
  sponsor_end_date: string | null

  // Display settings
  is_featured: boolean
  display_order: number | null

  // Analytics
  view_count: number
  click_count: number

  // Legacy link
  legacy_ai_app_id: string | null
  is_affiliate: boolean

  // Timestamps
  created_at: string
  updated_at: string
}

export interface DirectoryCategoryTool {
  category_id: string
  tool_id: string
  created_at: string
}

// Extended types with relations
export interface DirectoryToolWithCategories extends DirectoryTool {
  categories: DirectoryCategory[]
}

export interface DirectoryCategoryWithTools extends DirectoryCategory {
  tools: DirectoryTool[]
  tool_count?: number
}

// ============================================
// Sponsorship Packages & Entitlements Types
// ============================================

export interface SponsorshipPackage {
  id: string
  publication_id: string

  // Package Info
  name: string
  description: string | null

  // Included Benefits
  newsletter_ad_spots: number
  featured_listing_included: boolean
  featured_listing_months: number

  // Pricing
  price_monthly: number | null
  price_yearly: number | null

  // Stripe Integration
  stripe_product_id: string | null
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null

  // Display & Status
  display_order: number
  is_active: boolean
  is_featured: boolean

  // Metadata
  created_at: string
  updated_at: string
}

export type EntitlementType = 'newsletter_ad' | 'featured_listing'
export type EntitlementStatus = 'active' | 'expired' | 'cancelled' | 'paused'

export interface CustomerEntitlement {
  id: string
  publication_id: string
  clerk_user_id: string

  // Source of entitlement
  package_id: string | null

  // Entitlement Details
  entitlement_type: EntitlementType
  quantity_total: number
  quantity_used: number

  // Validity Period
  valid_from: string
  valid_until: string | null

  // Stripe Integration
  stripe_subscription_id: string | null
  stripe_customer_id: string | null

  // Status
  status: EntitlementStatus

  // Admin/Audit
  notes: string | null
  granted_by: string | null

  // Metadata
  created_at: string
  updated_at: string

  // Joined relations (optional)
  package?: SponsorshipPackage
}

// Extended types with computed fields
export interface CustomerEntitlementWithDetails extends CustomerEntitlement {
  quantity_remaining: number
  is_valid: boolean
  customer_email?: string
  customer_name?: string
}

// ============================================
// Ad Modules System Types
// ============================================

export type AdBlockType = 'title' | 'image' | 'body' | 'button'

export type AdSelectionMode = 'sequential' | 'random' | 'priority' | 'manual'

export type ModuleAdStatus = 'draft' | 'active' | 'paused' | 'completed'

export interface AdBlockTypeDefinition {
  id: string
  name: AdBlockType
  label: string
  description?: string
  default_config: Record<string, unknown>
  created_at: string
}

export interface Advertiser {
  id: string
  publication_id: string
  company_name: string
  contact_email?: string
  contact_name?: string
  logo_url?: string
  website_url?: string
  notes?: string
  last_used_date?: string
  times_used: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: AdSelectionMode
  block_order: AdBlockType[]
  config: Record<string, unknown>
  next_position: number  // For sequential mode: which display_order to select next
  created_at: string
  updated_at: string
}

export interface ModuleAd {
  id: string
  ad_module_id: string | null  // null = orphaned
  advertiser_id: string
  title?: string
  body?: string
  image_url?: string
  button_text: string
  button_url?: string
  status: ModuleAdStatus
  priority: number
  display_order: number  // Order for sequential rotation (set via drag-drop on ads page)
  times_used: number
  last_used_date?: string
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
}

export interface IssueModuleAd {
  id: string
  issue_id: string
  ad_module_id: string
  advertisement_id: string | null  // References advertisements table
  selection_mode?: AdSelectionMode
  selected_at: string
  used_at?: string
}

// Extended types with joins
/** @deprecated Use AdvertisementWithAdvertiser instead */
export interface ModuleAdWithAdvertiser extends ModuleAd {
  advertiser: Advertiser
}

// Advertisement with joined advertiser data
export interface AdvertisementWithAdvertiser extends Advertisement {
  advertiser?: Advertiser
}

export interface IssueModuleAdWithDetails extends IssueModuleAd {
  ad_module: AdModule
  advertisement?: AdvertisementWithAdvertiser  // The selected advertisement
}

export interface AdModuleWithAds extends AdModule {
  advertisements: Advertisement[]  // Ads assigned to this module
  ad_count?: number
}

// ===========================================
// Article Module System Types
// ===========================================

export type ArticleBlockType = 'source_image' | 'ai_image' | 'title' | 'body'
export type ArticleSelectionMode = 'top_score' | 'manual'

export interface ArticleModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: ArticleSelectionMode
  block_order: ArticleBlockType[]
  config: Record<string, unknown>
  articles_count: number
  lookback_hours: number
  ai_image_prompt: string | null
  created_at: string
  updated_at: string
}

export interface ArticleModuleCriteria {
  id: string
  article_module_id: string
  criteria_number: number
  name: string
  weight: number
  ai_prompt: string | null
  ai_model: string
  ai_provider: string
  temperature: number
  max_tokens: number
  expected_output: string | null
  is_active: boolean
  display_order: number
  enforce_minimum: boolean
  minimum_score: number | null
  created_at: string
  updated_at: string
}

export interface ArticleModulePrompt {
  id: string
  article_module_id: string
  prompt_type: 'article_title' | 'article_body'
  ai_prompt: string
  ai_model: string
  ai_provider: string
  temperature: number
  max_tokens: number
  expected_output: string | null
  created_at: string
  updated_at: string
}

export interface ModuleArticle {
  id: string
  post_id: string | null
  issue_id: string
  article_module_id: string
  headline: string | null
  content: string | null
  rank: number | null
  is_active: boolean
  skipped: boolean
  fact_check_score: number | null
  fact_check_details: string | null
  word_count: number | null
  review_position: number | null
  final_position: number | null
  breaking_news_score: number | null
  breaking_news_category: string | null
  ai_summary: string | null
  ai_title: string | null
  ai_image_url: string | null
  created_at: string
  updated_at: string
}

export interface IssueArticleModule {
  id: string
  issue_id: string
  article_module_id: string
  article_ids: string[]
  selection_mode: ArticleSelectionMode | null
  selected_at: string
  used_at: string | null
}

// Extended types with joins
export interface ArticleModuleWithCriteria extends ArticleModule {
  criteria: ArticleModuleCriteria[]
}

export interface ArticleModuleWithPrompts extends ArticleModule {
  prompts: ArticleModulePrompt[]
}

export interface ArticleModuleWithAll extends ArticleModule {
  criteria: ArticleModuleCriteria[]
  prompts: ArticleModulePrompt[]
  feeds?: RssFeed[]
}

export interface ModuleArticleWithPost extends ModuleArticle {
  rss_post?: RssPost
}

export interface IssueArticleModuleWithDetails extends IssueArticleModule {
  article_module: ArticleModule
  articles?: ModuleArticleWithPost[]
}

// ===========================================
// Text Box Module System Types
// ===========================================

export type TextBoxBlockType = 'static_text' | 'ai_prompt' | 'image'
export type TextSize = 'small' | 'medium' | 'large'
export type GenerationTiming = 'before_articles' | 'after_articles'
export type ImageType = 'static' | 'ai_generated'
export type TextBoxGenerationStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'manual'

export interface TextBoxModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  show_name: boolean  // Whether to show section header in newsletter
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TextBoxBlock {
  id: string
  text_box_module_id: string
  block_type: TextBoxBlockType
  display_order: number

  // Static Text Block fields
  static_content: string | null  // Rich HTML content from Quill editor
  text_size: TextSize

  // AI Prompt Block fields
  ai_prompt_json: Record<string, unknown> | null  // Full AI prompt configuration (model, messages, etc.)
  generation_timing: GenerationTiming
  is_bold: boolean  // When true, renders AI prompt content in bold
  is_italic: boolean  // When true, renders AI prompt content in italic

  // Image Block fields
  image_type: ImageType | null
  static_image_url: string | null  // URL for static uploaded images
  ai_image_prompt: string | null  // Prompt for AI image generation

  // Common fields
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IssueTextBoxModule {
  id: string
  issue_id: string
  text_box_module_id: string
  selected_at: string
  used_at: string | null  // Set when newsletter is sent
  created_at: string
  updated_at: string
  // Joined relations
  text_box_module?: TextBoxModule
}

export interface IssueTextBoxBlock {
  id: string
  issue_id: string
  text_box_block_id: string

  // Generated content (for AI blocks)
  generated_content: string | null  // AI-generated text content
  generated_image_url: string | null  // AI-generated image URL

  // Manual override content (user can override AI content)
  override_content: string | null
  override_image_url: string | null

  // Status tracking
  generation_status: TextBoxGenerationStatus
  generation_error: string | null
  generated_at: string | null

  created_at: string
  updated_at: string
  // Joined relations
  text_box_block?: TextBoxBlock
}

// Extended types with joins
export interface TextBoxModuleWithBlocks extends TextBoxModule {
  blocks: TextBoxBlock[]
}

export interface IssueTextBoxModuleWithDetails extends IssueTextBoxModule {
  text_box_module: TextBoxModule
  blocks: TextBoxBlock[]
  issue_blocks: IssueTextBoxBlock[]
}

// Placeholder data for AI content generation
export interface TextBoxPlaceholderData {
  // Basic metadata (available at before_articles timing)
  issue_date: string
  publication_name: string

  // Full context (available at after_articles timing)
  // Section-based articles (grouped by article module)
  section_articles?: {
    [sectionKey: string]: {
      name: string
      articles: Array<{
        headline: string
        content: string
        rank: number
      }>
    }
  }
  // Legacy flat articles array (for backwards compatibility)
  articles?: Array<{
    headline: string
    content: string
    rank: number
  }>
  ai_apps?: Array<{
    name: string
    tagline: string | null
    description: string
  }>
  poll?: {
    question: string
    options: string[]
  }
  ads?: Array<{
    title: string | null
    body: string | null
  }>
}

// ============================================
// Feedback Module Types
// ============================================
export type FeedbackBlockType = 'title' | 'static_text' | 'vote_options' | 'team_photos'

export interface FeedbackVoteOption {
  value: number      // e.g., 5, 3, 1
  label: string      // e.g., "Nailed it", "Average", "Fail"
  emoji: 'star'      // Currently only star emoji supported
}

export interface FeedbackTeamMember {
  name: string
  image_url: string
  title?: string
}

export interface FeedbackModule {
  id: string
  publication_id: string
  name: string
  display_order: number
  is_active: boolean
  show_name?: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
  // Legacy fields (kept for backwards compatibility, may be null)
  block_order?: FeedbackBlockType[]
  title_text?: string
  body_text?: string | null
  body_is_italic?: boolean
  sign_off_text?: string
  sign_off_is_italic?: boolean
  vote_options?: FeedbackVoteOption[]
  team_photos?: FeedbackTeamMember[]
}

export interface FeedbackBlock {
  id: string
  feedback_module_id: string
  block_type: FeedbackBlockType
  display_order: number
  is_enabled: boolean
  // Title block fields
  title_text: string | null
  // Static text block fields (for body or sign-off)
  static_content: string | null
  is_italic: boolean
  is_bold: boolean
  text_size: 'small' | 'medium' | 'large'
  label: string | null  // e.g., "Body" or "Sign-off" for UI display
  // Vote options block fields
  vote_options: FeedbackVoteOption[] | null
  // Team photos block fields
  team_photos: FeedbackTeamMember[] | null
  // General config
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FeedbackModuleWithBlocks extends FeedbackModule {
  blocks: FeedbackBlock[]
}

export interface FeedbackVote {
  id: string
  feedback_module_id: string
  publication_id: string
  issue_id: string | null
  subscriber_email: string
  ip_address: string | null
  selected_value: number
  selected_label: string
  voted_at: string
}

export interface FeedbackComment {
  id: string
  feedback_vote_id: string
  publication_id: string
  issue_id: string | null
  subscriber_email: string
  comment_text: string
  created_at: string
}

// For API responses with aggregated stats
export interface FeedbackVoteBreakdown {
  value: number
  label: string
  count: number
  percentage: number
  emails?: string[]  // Subscriber emails who voted this rating (for dashboard)
}

export interface FeedbackIssueStats {
  issue_id: string
  issue_date: string
  total_votes: number
  average_score: number
  vote_breakdown: FeedbackVoteBreakdown[]
  comments_count: number
}