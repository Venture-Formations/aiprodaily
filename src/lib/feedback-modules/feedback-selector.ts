/**
 * Feedback Module Selector
 *
 * Handles feedback module retrieval and vote/comment recording.
 * Feedback modules are singletons (one per publication).
 */

import { supabaseAdmin } from '../supabase'
import type { FeedbackModule, FeedbackVote, FeedbackComment, FeedbackVoteBreakdown, FeedbackIssueStats } from '@/types/database'

export class FeedbackModuleSelector {
  /**
   * Get the feedback module for a publication (singleton)
   */
  static async getFeedbackModule(publicationId: string): Promise<FeedbackModule | null> {
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[FeedbackSelector] Error fetching module:', error)
      return null
    }

    return module
  }

  /**
   * Ensure feedback module exists for a publication (create if not exists)
   */
  static async ensureFeedbackModule(publicationId: string): Promise<FeedbackModule> {
    // Try to get existing module
    const existing = await this.getFeedbackModule(publicationId)
    if (existing) {
      return existing
    }

    // Create new module with defaults
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .insert({
        publication_id: publicationId,
        name: 'Feedback',
        display_order: 999,
        is_active: false, // Start inactive
        block_order: ['title', 'body', 'vote_options', 'sign_off', 'team_photos'],
        title_text: "That's it for today!",
        body_text: null,
        body_is_italic: false,
        sign_off_text: 'See you tomorrow!',
        sign_off_is_italic: true,
        vote_options: [
          { value: 5, label: 'Nailed it', emoji: 'star' },
          { value: 3, label: 'Average', emoji: 'star' },
          { value: 1, label: 'Fail', emoji: 'star' }
        ],
        team_photos: [],
        config: {}
      })
      .select()
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error creating module:', error)
      throw new Error(`Failed to create feedback module: ${error.message}`)
    }

    console.log(`[FeedbackSelector] Created feedback module for publication ${publicationId}`)
    return module as FeedbackModule
  }

  /**
   * Update feedback module configuration
   */
  static async updateModule(
    moduleId: string,
    updates: Partial<Omit<FeedbackModule, 'id' | 'publication_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ success: boolean; module?: FeedbackModule; error?: string }> {
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .update(updates)
      .eq('id', moduleId)
      .select()
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error updating module:', error)
      return { success: false, error: error.message }
    }

    return { success: true, module: module as FeedbackModule }
  }

  /**
   * Record a vote (upsert - replaces existing vote from same email for same issue)
   */
  static async recordVote(
    moduleId: string,
    issueId: string,
    email: string,
    value: number,
    label: string,
    ipAddress?: string
  ): Promise<{ success: boolean; voteId?: string; isUpdate?: boolean; error?: string }> {
    // Get the module to verify and get publication_id
    const { data: module } = await supabaseAdmin
      .from('feedback_modules')
      .select('publication_id')
      .eq('id', moduleId)
      .single()

    if (!module) {
      return { success: false, error: 'Feedback module not found' }
    }

    // Check if vote exists
    const { data: existingVote } = await supabaseAdmin
      .from('feedback_votes')
      .select('id')
      .eq('feedback_module_id', moduleId)
      .eq('subscriber_email', email)
      .eq('issue_id', issueId)
      .single()

    const isUpdate = !!existingVote

    // Upsert the vote
    const { data: vote, error } = await supabaseAdmin
      .from('feedback_votes')
      .upsert({
        feedback_module_id: moduleId,
        publication_id: module.publication_id,
        issue_id: issueId,
        subscriber_email: email,
        ip_address: ipAddress || null,
        selected_value: value,
        selected_label: label,
        voted_at: new Date().toISOString()
      }, {
        onConflict: 'feedback_module_id,subscriber_email,issue_id'
      })
      .select('id')
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error recording vote:', error)
      return { success: false, error: error.message }
    }

    console.log(`[FeedbackSelector] ${isUpdate ? 'Updated' : 'Recorded'} vote: ${email} -> ${label} (${value}) for issue ${issueId}`)
    return { success: true, voteId: vote.id, isUpdate }
  }

  /**
   * Add a comment to an existing vote
   */
  static async addComment(
    voteId: string,
    commentText: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    // Get the vote to get publication_id and issue_id
    const { data: vote } = await supabaseAdmin
      .from('feedback_votes')
      .select('publication_id, issue_id, subscriber_email')
      .eq('id', voteId)
      .single()

    if (!vote) {
      return { success: false, error: 'Vote not found' }
    }

    // Check for existing comment and update or insert
    const { data: existingComment } = await supabaseAdmin
      .from('feedback_comments')
      .select('id')
      .eq('feedback_vote_id', voteId)
      .single()

    let result
    if (existingComment) {
      // Update existing comment
      result = await supabaseAdmin
        .from('feedback_comments')
        .update({ comment_text: commentText })
        .eq('id', existingComment.id)
        .select('id')
        .single()
    } else {
      // Insert new comment
      result = await supabaseAdmin
        .from('feedback_comments')
        .insert({
          feedback_vote_id: voteId,
          publication_id: vote.publication_id,
          issue_id: vote.issue_id,
          subscriber_email: vote.subscriber_email,
          comment_text: commentText
        })
        .select('id')
        .single()
    }

    if (result.error) {
      console.error('[FeedbackSelector] Error adding comment:', result.error)
      return { success: false, error: result.error.message }
    }

    console.log(`[FeedbackSelector] ${existingComment ? 'Updated' : 'Added'} comment for vote ${voteId}`)
    return { success: true, commentId: result.data.id }
  }

  /**
   * Get results for an issue with vote breakdown
   */
  static async getIssueResults(
    moduleId: string,
    issueId: string,
    email?: string
  ): Promise<{
    total_votes: number
    breakdown: FeedbackVoteBreakdown[]
    user_vote?: { value: number; label: string }
    average_score: number
  }> {
    // Get all votes for this issue
    const { data: votes, error } = await supabaseAdmin
      .from('feedback_votes')
      .select('selected_value, selected_label, subscriber_email')
      .eq('feedback_module_id', moduleId)
      .eq('issue_id', issueId)

    if (error || !votes) {
      console.error('[FeedbackSelector] Error fetching votes:', error)
      return { total_votes: 0, breakdown: [], average_score: 0 }
    }

    const total = votes.length
    if (total === 0) {
      return { total_votes: 0, breakdown: [], average_score: 0 }
    }

    // Calculate breakdown
    const countsByValue: Record<number, { label: string; count: number }> = {}
    let totalScore = 0

    for (const vote of votes) {
      if (!countsByValue[vote.selected_value]) {
        countsByValue[vote.selected_value] = { label: vote.selected_label, count: 0 }
      }
      countsByValue[vote.selected_value].count++
      totalScore += vote.selected_value
    }

    const breakdown: FeedbackVoteBreakdown[] = Object.entries(countsByValue)
      .map(([value, { label, count }]) => ({
        value: parseInt(value),
        label,
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.value - a.value) // Sort by value descending (highest first)

    // Find user's vote if email provided
    let user_vote: { value: number; label: string } | undefined
    if (email) {
      const userVote = votes.find(v => v.subscriber_email.toLowerCase() === email.toLowerCase())
      if (userVote) {
        user_vote = { value: userVote.selected_value, label: userVote.selected_label }
      }
    }

    const average_score = Math.round((totalScore / total) * 10) / 10

    return { total_votes: total, breakdown, user_vote, average_score }
  }

  /**
   * Get vote by email for an issue (to check if user already voted)
   */
  static async getVoteByEmail(
    moduleId: string,
    issueId: string,
    email: string
  ): Promise<FeedbackVote | null> {
    const { data: vote, error } = await supabaseAdmin
      .from('feedback_votes')
      .select('*')
      .eq('feedback_module_id', moduleId)
      .eq('issue_id', issueId)
      .eq('subscriber_email', email)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[FeedbackSelector] Error fetching vote:', error)
    }

    return vote
  }

  /**
   * Get analytics overview for dashboard
   */
  static async getAnalytics(
    publicationId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<FeedbackIssueStats[]> {
    // Get the feedback module
    const module = await this.getFeedbackModule(publicationId)
    if (!module) {
      return []
    }

    // Build query for votes
    let query = supabaseAdmin
      .from('feedback_votes')
      .select('issue_id, selected_value, selected_label, voted_at')
      .eq('feedback_module_id', module.id)
      .not('issue_id', 'is', null)

    if (dateFrom) {
      query = query.gte('voted_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('voted_at', dateTo)
    }

    const { data: votes, error } = await query

    if (error || !votes) {
      console.error('[FeedbackSelector] Error fetching analytics:', error)
      return []
    }

    // Get comment counts per issue
    let commentQuery = supabaseAdmin
      .from('feedback_comments')
      .select('issue_id')
      .eq('publication_id', publicationId)
      .not('issue_id', 'is', null)

    if (dateFrom) {
      commentQuery = commentQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      commentQuery = commentQuery.lte('created_at', dateTo)
    }

    const { data: comments } = await commentQuery

    // Count comments per issue
    const commentCounts: Record<string, number> = {}
    if (comments) {
      for (const comment of comments) {
        if (comment.issue_id) {
          commentCounts[comment.issue_id] = (commentCounts[comment.issue_id] || 0) + 1
        }
      }
    }

    // Get issue dates
    const issueIds = Array.from(new Set(votes.map(v => v.issue_id).filter(Boolean)))
    let issueDates: Record<string, string> = {}

    if (issueIds.length > 0) {
      const { data: issues } = await supabaseAdmin
        .from('issues')
        .select('id, issue_date')
        .in('id', issueIds)

      if (issues) {
        issueDates = Object.fromEntries(issues.map(i => [i.id, i.issue_date]))
      }
    }

    // Group votes by issue
    const votesByIssue: Record<string, typeof votes> = {}
    for (const vote of votes) {
      if (vote.issue_id) {
        if (!votesByIssue[vote.issue_id]) {
          votesByIssue[vote.issue_id] = []
        }
        votesByIssue[vote.issue_id].push(vote)
      }
    }

    // Calculate stats per issue
    const stats: FeedbackIssueStats[] = []

    for (const [issueId, issueVotes] of Object.entries(votesByIssue)) {
      const total = issueVotes.length
      let totalScore = 0
      const countsByValue: Record<number, { label: string; count: number }> = {}

      for (const vote of issueVotes) {
        if (!countsByValue[vote.selected_value]) {
          countsByValue[vote.selected_value] = { label: vote.selected_label, count: 0 }
        }
        countsByValue[vote.selected_value].count++
        totalScore += vote.selected_value
      }

      const breakdown: FeedbackVoteBreakdown[] = Object.entries(countsByValue)
        .map(([value, { label, count }]) => ({
          value: parseInt(value),
          label,
          count,
          percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.value - a.value)

      stats.push({
        issue_id: issueId,
        issue_date: issueDates[issueId] || '',
        total_votes: total,
        average_score: Math.round((totalScore / total) * 10) / 10,
        vote_breakdown: breakdown,
        comments_count: commentCounts[issueId] || 0
      })
    }

    // Sort by issue date descending
    stats.sort((a, b) => b.issue_date.localeCompare(a.issue_date))

    return stats
  }

  /**
   * Get recent comments for dashboard
   */
  static async getRecentComments(
    publicationId: string,
    limit: number = 20
  ): Promise<Array<FeedbackComment & { vote?: FeedbackVote }>> {
    const { data: comments, error } = await supabaseAdmin
      .from('feedback_comments')
      .select(`
        *,
        vote:feedback_votes(*)
      `)
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[FeedbackSelector] Error fetching comments:', error)
      return []
    }

    return (comments || []).map(c => ({
      ...c,
      vote: c.vote?.[0] || undefined
    }))
  }

  /**
   * Get comments for a specific issue
   */
  static async getIssueComments(
    publicationId: string,
    issueId: string
  ): Promise<Array<FeedbackComment & { vote?: FeedbackVote }>> {
    const { data: comments, error } = await supabaseAdmin
      .from('feedback_comments')
      .select(`
        *,
        vote:feedback_votes(*)
      `)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[FeedbackSelector] Error fetching issue comments:', error)
      return []
    }

    return (comments || []).map(c => ({
      ...c,
      vote: c.vote?.[0] || undefined
    }))
  }
}
