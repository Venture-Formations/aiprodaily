export interface Tool {
  id: string
  tool_name: string
  tagline: string | null
  description: string
  website_url: string
  tool_image_url: string | null
  logo_image_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  plan: 'free' | 'monthly' | 'yearly'
  is_sponsored: boolean
  is_featured: boolean
  submitter_email: string
  submitter_name: string | null
  created_at: string
  rejection_reason: string | null
  categories: { id: string; name: string; slug: string }[]
}

export interface Category {
  id: string
  name: string
  slug: string
}

export type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all'

export const statusColors: Record<Tool['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
}

export const planLabels: Record<Tool['plan'], string> = {
  free: 'Free',
  monthly: 'Monthly Sponsor',
  yearly: 'Yearly Sponsor'
}

/** Check if a URL is a valid http(s) image URL */
export const isValidImageUrl = (url: string | null): boolean => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
