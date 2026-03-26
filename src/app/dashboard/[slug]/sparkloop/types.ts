export interface Recommendation {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  type: 'free' | 'paid'
  status: 'active' | 'paused' | 'archived' | 'awaiting_approval'
  cpa: number | null
  sparkloop_rcr: number | null
  max_payout: number | null
  screening_period: number | null
  excluded: boolean
  excluded_reason: string | null
  paused_reason: string | null
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  our_cr: number | null
  our_rcr: number | null
  sparkloop_confirmed: number
  sparkloop_pending: number
  sparkloop_rejected: number
  sparkloop_earnings: number
  sparkloop_net_earnings: number
  our_total_subscribes: number
  our_confirms: number
  our_rejections: number
  our_pending: number
  remaining_budget_dollars: number | null
  last_synced_at: string | null
  calculated_score: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
  unique_ips: number
  override_cr: number | null
  override_rcr: number | null
  override_slip: number | null
  alltime_slip: number
  effective_slip: number
  slip_source: string
  matured_sends: number
  submission_capped?: boolean
  page_impressions: number
  page_submissions: number
  page_cr: number | null
  rcr_14d: number | null
  rcr_30d: number | null
  slippage_14d: number | null
  slippage_30d: number | null
  sends_14d: number
  sends_30d: number
  confirms_gained_14d: number
  confirms_gained_30d: number
  eligible_for_module: boolean
}
