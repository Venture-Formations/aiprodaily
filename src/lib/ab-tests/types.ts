export type SubscribeAbTestStatus = 'draft' | 'active' | 'ended'

export type SubscribeAbEventType =
  | 'page_view'
  | 'signup'
  | 'reached_offers'
  | 'completed_info'
  | 'sparkloop_signup'

export interface SubscribePageContent {
  heading?: string
  subheading?: string
  tagline?: string
  logo_url?: string
  cta_text?: string
  /** When 'true', renders an optional phone-number input below the email field. */
  collect_phone?: string
  phone_label?: string
  phone_placeholder?: string
  [key: string]: string | undefined
}

export interface SubscribePage {
  id: string
  publication_id: string
  name: string
  content: SubscribePageContent
  is_archived: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface SubscribeAbTest {
  id: string
  publication_id: string
  name: string
  status: SubscribeAbTestStatus
  start_date: string | null
  end_date: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface SubscribeAbTestVariant {
  id: string
  test_id: string
  page_id: string
  label: string
  weight: number
  display_order: number
  created_at: string
}

export interface SubscribeAbTestVariantWithPage extends SubscribeAbTestVariant {
  page: SubscribePage
}

export interface ActiveSubscribeAbTest {
  test: SubscribeAbTest
  variants: SubscribeAbTestVariantWithPage[]
}

export interface SubscribeAbAssignment {
  id: string
  test_id: string
  variant_id: string
  publication_id: string
  visitor_id: string
  subscriber_email: string | null
  ip_address: string | null
  user_agent: string | null
  is_bot_ua: boolean
  assigned_at: string
}

export interface VariantStatsRow {
  variant_id: string
  label: string
  weight: number
  page_views: number
  signups: number
  reached_offers: number
  completed_info: number
  sparkloop_signups: number
}
