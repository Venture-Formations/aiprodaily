import { ErrorHandler, SlackNotificationService } from '../slack'
import { SupabaseImageStorage } from '../supabase-image-storage'
import { ArticleArchiveService } from '../article-archive'
import { ArticleExtractor } from '../article-extractor'
import { supabaseAdmin } from '../supabase'

/**
 * Shared dependencies injected into all RSS processor modules.
 */
export interface RSSProcessorContext {
  errorHandler: ErrorHandler
  slack: SlackNotificationService
  imageStorage: SupabaseImageStorage
  archiveService: ArticleArchiveService
  articleExtractor: ArticleExtractor
}

/**
 * Create a default RSSProcessorContext with fresh instances.
 */
export function createDefaultContext(): RSSProcessorContext {
  return {
    errorHandler: new ErrorHandler(),
    slack: new SlackNotificationService(),
    imageStorage: new SupabaseImageStorage(),
    archiveService: new ArticleArchiveService(),
    articleExtractor: new ArticleExtractor(),
  }
}

// AI refusal phrases that should never appear in published content
export const AI_REFUSAL_PATTERNS = [
  "i'm sorry",
  "i cannot",
  "i can't",
  "i need the content",
  "i need more information",
  "i don't have",
  "i do not have",
  "unable to generate",
  "unable to create",
  "can you provide more",
  "could you provide",
  "please provide",
  "i'd need",
  "i would need",
  "provide more information",
  "provide more details",
  "provide a brief summary",
  "key details of the article",
  "without access to",
  "without the full",
]

/**
 * Detect AI refusal/apology messages that should never be stored as article content.
 * Returns the matched phrase if a refusal is detected, or null if content is valid.
 */
export function detectAIRefusal(content: string): string | null {
  const lower = content.toLowerCase().trim()
  for (const phrase of AI_REFUSAL_PATTERNS) {
    if (lower.includes(phrase)) {
      return phrase
    }
  }
  return null
}

/**
 * Helper: Get publication_id from issueId
 */
export async function getNewsletterIdFromIssue(issueId: string): Promise<string> {
  const { data: issue, error } = await supabaseAdmin
    .from('publication_issues')
    .select('publication_id')
    .eq('id', issueId)
    .single()

  if (error || !issue || !issue.publication_id) {
    throw new Error(`Failed to get publication_id for issue ${issueId}`)
  }

  return issue.publication_id
}

/**
 * Log info message to system_logs
 */
export async function logInfo(message: string, context: Record<string, any> = {}) {
  await supabaseAdmin
    .from('system_logs')
    .insert([{
      level: 'info',
      message,
      context,
      source: 'rss_processor'
    }])
}

/**
 * Log error message to system_logs
 */
export async function logError(message: string, context: Record<string, any> = {}) {
  await supabaseAdmin
    .from('system_logs')
    .insert([{
      level: 'error',
      message,
      context,
      source: 'rss_processor'
    }])
}
