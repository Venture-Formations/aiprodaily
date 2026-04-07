import type { EmailMetrics, Newsletterissue } from '@/types/database'

export interface IssueWithMetrics extends Newsletterissue {
  email_metrics?: EmailMetrics
}

export interface FeedbackAnalytics {
  totalResponses: number
  successfulSyncs: number
  syncSuccessRate: number
  sectionCounts: { [key: string]: number }
  dailyResponses: { [key: string]: number }
  recentResponses: any[]
  dateRange: { start: string; end: string }
}

export interface LinkClickAnalytics {
  totalClicks: number
  uniqueUsers: number
  clicksBySection: { [key: string]: number }
  uniqueUsersBySection: { [key: string]: number }
  dailyClicks: { [key: string]: number }
  topUrls: { url: string; section: string; clicks: number; unique_users: number }[]
  clicksByissue: { [key: string]: number }
  uniqueClickersByIssue: { [key: string]: number }
  recentClicks: any[]
  dateRange: { start: string; end: string }
}

export interface Props {
  slug: string
  excludeIps?: boolean
}

export interface Averages {
  avgOpenRate: number
  avgClickRate: number
  avgBounceRate: number
  avgUnsubscribeRate: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  issueCount: number
  usingOwnClickData: boolean
}
