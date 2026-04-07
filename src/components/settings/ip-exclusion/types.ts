export interface ExcludedIp {
  id: string
  ip_address: string
  is_range: boolean
  cidr_prefix: number | null
  reason: string | null
  added_by: string | null
  created_at: string
}

export interface IpSuggestion {
  ip_address: string
  total_activity: number
  poll_votes: number
  link_clicks: number
  unique_emails: number
  time_span_seconds: number
  reason: string
  suspicion_level: 'high' | 'medium'
  known_scanner: {
    organization: string
    type: string
    description: string
    recommended_cidr: string
  } | null
}

export interface DetectedScanner {
  organization: string
  type: string
  ip_count: number
  total_activity: number
  recommended_ranges: string[]
}
