import type { Advertisement, AdModule } from '@/types/database'

export interface AdWithRelations extends Advertisement {
  ad_module?: { id: string; name: string } | null
  advertiser?: { id: string; company_name: string; logo_url?: string } | null
}

export interface CompanyGroup {
  id: string
  ad_module_id: string
  advertiser_id: string
  display_order: number
  next_ad_position: number
  times_used: number
  priority: number
  frequency: string
  times_paid: number
  paid: boolean
  last_used_date?: string
  advertiser: { id: string; company_name: string; logo_url?: string; is_active: boolean; last_used_date?: string; times_used: number }
  advertisements: Advertisement[]
}

export type StatusTab = 'active' | 'inactive' | 'review'

export type { Advertisement, AdModule }
