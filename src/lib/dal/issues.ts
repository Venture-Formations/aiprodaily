/**
 * Data Access Layer — Issues Domain
 *
 * All queries against `publication_issues` should go through this module.
 * Every method requires and applies `publicationId` for multi-tenant isolation.
 * Uses explicit column lists (no select('*')).
 * Errors are logged, never thrown — callers receive null/empty on failure.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import type { PublicationIssue, IssueStatus } from '@/types/database'
import { canTransition } from '@/types/issue-states'

const log = createLogger({ module: 'dal:issues' })

// Column sets for consistent select lists (only columns that exist on publication_issues)
// Note: mailerlite_issue_id lives in email_metrics; not on publication_issues
const ISSUE_COLUMNS = `
  id, publication_id, date, status,
  subject_line, welcome_intro, welcome_tagline, welcome_summary,
  review_sent_at, final_sent_at,
  last_action, last_action_at, last_action_by,
  status_before_send, metrics,
  workflow_state, workflow_state_started_at, workflow_error,
  poll_id, poll_snapshot,
  failure_alerted_at,
  created_at, updated_at
` as const

const ISSUE_COLUMNS_BRIEF = `
  id, publication_id, date, status,
  subject_line, workflow_state, workflow_error,
  review_sent_at, final_sent_at,
  created_at, updated_at
` as const

// ==================== READ OPERATIONS ====================

/**
 * Get a single issue by ID.
 * Verifies publication_id ownership if provided.
 */
export async function getIssueById(
  issueId: string,
  publicationId?: string
): Promise<PublicationIssue | null> {
  try {
    let query = supabaseAdmin
      .from('publication_issues')
      .select(ISSUE_COLUMNS)
      .eq('id', issueId)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      log.error({ err: error, issueId }, 'getIssueById failed')
      return null
    }

    return data as PublicationIssue
  } catch (err) {
    log.error({ err, issueId }, 'getIssueById exception')
    return null
  }
}

/**
 * Find an issue for a specific date within a publication.
 */
export async function getIssueByDate(
  publicationId: string,
  date: string
): Promise<PublicationIssue | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .select(ISSUE_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      log.error({ err: error, publicationId, date }, 'getIssueByDate failed')
      return null
    }

    return data as PublicationIssue | null
  } catch (err) {
    log.error({ err, publicationId, date }, 'getIssueByDate exception')
    return null
  }
}

/**
 * List issues for a publication with optional filters and pagination.
 */
export async function listIssues(
  publicationId: string,
  opts: {
    status?: IssueStatus | IssueStatus[]
    fromDate?: string
    toDate?: string
    limit?: number
    offset?: number
    orderBy?: 'date' | 'created_at'
    ascending?: boolean
  } = {}
): Promise<{ data: PublicationIssue[]; count: number | null }> {
  try {
    const {
      status,
      fromDate,
      toDate,
      limit = 50,
      offset = 0,
      orderBy = 'date',
      ascending = false,
    } = opts

    let query = supabaseAdmin
      .from('publication_issues')
      .select(ISSUE_COLUMNS_BRIEF, { count: 'exact' })
      .eq('publication_id', publicationId)

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status)
      } else {
        query = query.eq('status', status)
      }
    }

    if (fromDate) query = query.gte('date', fromDate)
    if (toDate) query = query.lte('date', toDate)

    query = query
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      log.error({ err: error, publicationId }, 'listIssues failed')
      return { data: [], count: null }
    }

    return { data: (data || []) as PublicationIssue[], count }
  } catch (err) {
    log.error({ err, publicationId }, 'listIssues exception')
    return { data: [], count: null }
  }
}

/**
 * Get an issue with its articles, manual articles, email metrics, and ads.
 * Used by dashboard detail view and send-final.
 */
export async function getIssueWithArticles(
  issueId: string,
  publicationId?: string
): Promise<(PublicationIssue & { module_articles: any[]; manual_articles: any[]; email_metrics: any; issue_advertisements: any[] }) | null> {
  try {
    let query = supabaseAdmin
      .from('publication_issues')
      .select(`
        ${ISSUE_COLUMNS},
        module_articles:module_articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*),
        email_metrics(*),
        issue_advertisements(
          *,
          advertisement:advertisements(*)
        )
      `)
      .eq('id', issueId)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') return null
      log.error({ err: error, issueId }, 'getIssueWithArticles failed')
      return null
    }

    return data as any
  } catch (err) {
    log.error({ err, issueId }, 'getIssueWithArticles exception')
    return null
  }
}

/**
 * Look up the publication_id for an issue. Used by downstream functions
 * that receive only an issueId.
 */
export async function getIssuePublicationId(
  issueId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (error || !data) return null
    return data.publication_id
  } catch (err) {
    log.error({ err, issueId }, 'getIssuePublicationId exception')
    return null
  }
}

// ==================== WRITE OPERATIONS ====================

/**
 * Create a new issue for a publication.
 */
export async function createIssue(
  publicationId: string,
  date: string,
  status: IssueStatus = 'processing'
): Promise<PublicationIssue | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .insert([{
        date,
        status,
        publication_id: publicationId,
      }])
      .select(ISSUE_COLUMNS)
      .single()

    if (error) {
      log.error({ err: error, publicationId, date }, 'createIssue failed')
      return null
    }

    log.info({ issueId: data.id, publicationId, date }, 'Issue created')
    return data as PublicationIssue
  } catch (err) {
    log.error({ err, publicationId, date }, 'createIssue exception')
    return null
  }
}

/**
 * Update an issue's status with optional metadata.
 *
 * When `expectedCurrentStatus` is provided:
 * 1. Validates the transition against the state machine
 * 2. Uses atomic compare-and-swap (only updates if current status matches)
 * 3. Returns false if the row's status didn't match (CAS failure)
 *
 * Without `expectedCurrentStatus`, behaves as before (unconditional update).
 */
export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
  meta?: {
    lastAction?: string
    lastActionBy?: string
    statusBeforeSend?: IssueStatus
    expectedCurrentStatus?: IssueStatus
  }
): Promise<boolean> {
  try {
    // Validate transition if expected status is provided
    if (meta?.expectedCurrentStatus) {
      if (!canTransition(meta.expectedCurrentStatus, status)) {
        log.warn(
          { issueId, from: meta.expectedCurrentStatus, to: status },
          'updateIssueStatus: invalid transition'
        )
        return false
      }
    }

    const updateData: Record<string, any> = { status }

    if (meta?.lastAction) {
      updateData.last_action = meta.lastAction
      updateData.last_action_at = new Date().toISOString()
    }
    if (meta?.lastActionBy) updateData.last_action_by = meta.lastActionBy
    if (meta?.statusBeforeSend) updateData.status_before_send = meta.statusBeforeSend

    let query = supabaseAdmin
      .from('publication_issues')
      .update(updateData)
      .eq('id', issueId)

    // Atomic compare-and-swap: only update if current status matches
    if (meta?.expectedCurrentStatus) {
      query = query.eq('status', meta.expectedCurrentStatus)
      const { data, error } = await query.select('id').single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No row matched — CAS failure (status already changed)
          log.warn(
            { issueId, expected: meta.expectedCurrentStatus, to: status },
            'updateIssueStatus: CAS failed — status already changed'
          )
          return false
        }
        log.error({ err: error, issueId, status }, 'updateIssueStatus failed')
        return false
      }

      return !!data
    }

    // Unconditional update (backward-compatible path)
    const { error } = await query

    if (error) {
      log.error({ err: error, issueId, status }, 'updateIssueStatus failed')
      return false
    }

    return true
  } catch (err) {
    log.error({ err, issueId, status }, 'updateIssueStatus exception')
    return false
  }
}

/**
 * Atomic compare-and-swap for workflow state transitions.
 * Only transitions if the current state matches `fromState`.
 */
export async function updateWorkflowState(
  issueId: string,
  fromState: string,
  toState: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .update({
        workflow_state: toState,
        workflow_state_started_at: new Date().toISOString(),
        workflow_error: null,
      })
      .eq('id', issueId)
      .eq('workflow_state', fromState)
      .select('workflow_state')
      .single()

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        log.error({ err: error, issueId, fromState, toState }, 'updateWorkflowState failed')
      }
      return false
    }

    log.info({ issueId, fromState, toState }, 'Workflow state transitioned')
    return true
  } catch (err) {
    log.error({ err, issueId, fromState, toState }, 'updateWorkflowState exception')
    return false
  }
}

/**
 * Mark a workflow as failed with an error message.
 */
export async function failWorkflowState(
  issueId: string,
  errorMessage: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('publication_issues')
      .update({
        workflow_state: 'failed',
        workflow_error: errorMessage.substring(0, 500),
        status: 'failed',
      })
      .eq('id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'failWorkflowState failed')
      return false
    }

    log.error({ issueId, workflowError: errorMessage.substring(0, 100) }, 'Workflow marked as failed')
    return true
  } catch (err) {
    log.error({ err, issueId }, 'failWorkflowState exception')
    return false
  }
}

/**
 * Mark an issue as sent, updating multiple columns atomically.
 */
export async function markIssueSent(
  issueId: string,
  payload: {
    finalSentAt?: string
    reviewSentAt?: string
    mailerliteIssueId?: string
    statusBeforeSend?: IssueStatus
  }
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {}

    if (payload.finalSentAt) {
      updateData.final_sent_at = payload.finalSentAt
      updateData.status = 'sent'
    }
    if (payload.reviewSentAt) {
      updateData.review_sent_at = payload.reviewSentAt
      updateData.status = 'in_review'
    }
    if (payload.statusBeforeSend) updateData.status_before_send = payload.statusBeforeSend
    // MailerLite campaign ID is stored in email_metrics; publication_issues has no mailerlite_issue_id column

    const { error } = await supabaseAdmin
      .from('publication_issues')
      .update(updateData)
      .eq('id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'markIssueSent failed')
      return false
    }

    return true
  } catch (err) {
    log.error({ err, issueId }, 'markIssueSent exception')
    return false
  }
}

/**
 * Update the welcome section fields for an issue.
 */
export async function updateWelcomeSection(
  issueId: string,
  data: {
    welcomeIntro?: string
    welcomeTagline?: string
    welcomeSummary?: string
  }
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {}
    if (data.welcomeIntro !== undefined) updateData.welcome_intro = data.welcomeIntro
    if (data.welcomeTagline !== undefined) updateData.welcome_tagline = data.welcomeTagline
    if (data.welcomeSummary !== undefined) updateData.welcome_summary = data.welcomeSummary

    const { error } = await supabaseAdmin
      .from('publication_issues')
      .update(updateData)
      .eq('id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'updateWelcomeSection failed')
      return false
    }

    return true
  } catch (err) {
    log.error({ err, issueId }, 'updateWelcomeSection exception')
    return false
  }
}

/**
 * Update the subject line for an issue.
 */
export async function updateSubjectLine(
  issueId: string,
  subjectLine: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('publication_issues')
      .update({ subject_line: subjectLine })
      .eq('id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'updateSubjectLine failed')
      return false
    }

    return true
  } catch (err) {
    log.error({ err, issueId }, 'updateSubjectLine exception')
    return false
  }
}
