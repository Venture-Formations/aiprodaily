/**
 * Feedback Module Selector
 *
 * Handles feedback module retrieval and vote/comment recording.
 * Feedback modules are singletons (one per publication).
 * Now uses block-based architecture with feedback_blocks table.
 */

import { supabaseAdmin } from '../supabase'
import { isIPExcluded, IPExclusion } from '../ip-utils'
import type { FeedbackModule, FeedbackModuleWithBlocks, FeedbackBlock, FeedbackVote, FeedbackComment, FeedbackVoteBreakdown, FeedbackIssueStats } from '@/types/database'

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
   * Get the feedback module with its blocks
   */
  static async getFeedbackModuleWithBlocks(publicationId: string): Promise<FeedbackModuleWithBlocks | null> {
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .select(`
        *,
        blocks:feedback_blocks(*)
      `)
      .eq('publication_id', publicationId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[FeedbackSelector] Error fetching module with blocks:', error)
      return null
    }

    if (!module) return null

    // Sort blocks by display_order
    return {
      ...module,
      blocks: (module.blocks || []).sort((a: FeedbackBlock, b: FeedbackBlock) =>
        a.display_order - b.display_order
      )
    } as FeedbackModuleWithBlocks
  }

  /**
   * Get a feedback module by its ID
   */
  static async getModuleById(moduleId: string): Promise<FeedbackModule | null> {
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .select('*')
      .eq('id', moduleId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[FeedbackSelector] Error fetching module by ID:', error)
      return null
    }

    return module
  }

  /**
   * Get blocks for a feedback module
   */
  static async getBlocks(moduleId: string): Promise<FeedbackBlock[]> {
    const { data: blocks, error } = await supabaseAdmin
      .from('feedback_blocks')
      .select('*')
      .eq('feedback_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[FeedbackSelector] Error fetching blocks:', error)
      return []
    }

    return blocks as FeedbackBlock[]
  }

  /**
   * Update a feedback block
   */
  static async updateBlock(
    blockId: string,
    updates: Partial<Omit<FeedbackBlock, 'id' | 'feedback_module_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ success: boolean; block?: FeedbackBlock; error?: string }> {
    const { data: block, error } = await supabaseAdmin
      .from('feedback_blocks')
      .update(updates)
      .eq('id', blockId)
      .select()
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error updating block:', error)
      return { success: false, error: error.message }
    }

    return { success: true, block: block as FeedbackBlock }
  }

  /**
   * Create a new block for a feedback module
   */
  static async createBlock(
    moduleId: string,
    blockType: 'title' | 'static_text' | 'vote_options' | 'team_photos',
    displayOrder?: number
  ): Promise<{ success: boolean; block?: FeedbackBlock; error?: string }> {
    // Get max display_order if not provided
    if (displayOrder === undefined) {
      const { data: blocks } = await supabaseAdmin
        .from('feedback_blocks')
        .select('display_order')
        .eq('feedback_module_id', moduleId)
        .order('display_order', { ascending: false })
        .limit(1)

      displayOrder = (blocks && blocks.length > 0) ? blocks[0].display_order + 1 : 0
    }

    // Default data based on block type
    let blockData: Record<string, unknown> = {
      feedback_module_id: moduleId,
      block_type: blockType,
      display_order: displayOrder,
      is_enabled: true
    }

    if (blockType === 'title') {
      blockData.title_text = ''
    } else if (blockType === 'static_text') {
      blockData.static_content = ''
      blockData.is_italic = false
      blockData.is_bold = false
      blockData.text_size = 'medium'
    } else if (blockType === 'vote_options') {
      blockData.vote_options = [
        { value: 5, label: 'Great', emoji: 'star' },
        { value: 1, label: 'Not great', emoji: 'star' }
      ]
    } else if (blockType === 'team_photos') {
      blockData.team_photos = []
    }

    const { data: block, error } = await supabaseAdmin
      .from('feedback_blocks')
      .insert(blockData)
      .select()
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error creating block:', error)
      return { success: false, error: error.message }
    }

    return { success: true, block: block as FeedbackBlock }
  }

  /**
   * Delete a feedback block
   */
  static async deleteBlock(blockId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('feedback_blocks')
      .delete()
      .eq('id', blockId)

    if (error) {
      console.error('[FeedbackSelector] Error deleting block:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Reorder blocks within a module
   */
  static async reorderBlocks(
    moduleId: string,
    blockIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update each block's display_order
      for (let i = 0; i < blockIds.length; i++) {
        const { error } = await supabaseAdmin
          .from('feedback_blocks')
          .update({ display_order: i })
          .eq('id', blockIds[i])
          .eq('feedback_module_id', moduleId)

        if (error) {
          console.error('[FeedbackSelector] Error reordering block:', error)
          return { success: false, error: error.message }
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[FeedbackSelector] Error reordering blocks:', error)
      return { success: false, error: 'Failed to reorder blocks' }
    }
  }

  /**
   * Ensure feedback module exists for a publication (create if not exists)
   * Also creates default blocks
   */
  static async ensureFeedbackModule(publicationId: string): Promise<FeedbackModuleWithBlocks> {
    // Try to get existing module with blocks
    const existing = await this.getFeedbackModuleWithBlocks(publicationId)
    if (existing) {
      // If module exists but has no blocks, create default blocks
      if (!existing.blocks || existing.blocks.length === 0) {
        await this.createDefaultBlocks(existing.id)
        return await this.getFeedbackModuleWithBlocks(publicationId) as FeedbackModuleWithBlocks
      }
      return existing
    }

    // Create new module
    const { data: module, error } = await supabaseAdmin
      .from('feedback_modules')
      .insert({
        publication_id: publicationId,
        name: 'Feedback',
        display_order: 999,
        is_active: false, // Start inactive
        config: {}
      })
      .select()
      .single()

    if (error) {
      console.error('[FeedbackSelector] Error creating module:', error)
      throw new Error(`Failed to create feedback module: ${error.message}`)
    }

    // Create default blocks
    await this.createDefaultBlocks(module.id)

    console.log(`[FeedbackSelector] Created feedback module with blocks for publication ${publicationId}`)
    return await this.getFeedbackModuleWithBlocks(publicationId) as FeedbackModuleWithBlocks
  }

  /**
   * Create default blocks for a feedback module
   */
  static async createDefaultBlocks(moduleId: string): Promise<void> {
    const defaultBlocks = [
      {
        feedback_module_id: moduleId,
        block_type: 'title',
        display_order: 0,
        is_enabled: true,
        title_text: "That's it for today!"
      },
      {
        feedback_module_id: moduleId,
        block_type: 'static_text',
        display_order: 1,
        is_enabled: false,
        static_content: null,
        is_italic: false,
        is_bold: false,
        text_size: 'medium',
        label: 'Body'
      },
      {
        feedback_module_id: moduleId,
        block_type: 'vote_options',
        display_order: 2,
        is_enabled: true,
        vote_options: [
          { value: 5, label: 'Nailed it', emoji: 'star' },
          { value: 3, label: 'Average', emoji: 'star' },
          { value: 1, label: 'Fail', emoji: 'star' }
        ]
      },
      {
        feedback_module_id: moduleId,
        block_type: 'static_text',
        display_order: 3,
        is_enabled: true,
        static_content: 'See you tomorrow!',
        is_italic: true,
        is_bold: false,
        text_size: 'medium',
        label: 'Sign-off'
      },
      {
        feedback_module_id: moduleId,
        block_type: 'team_photos',
        display_order: 4,
        is_enabled: false,
        team_photos: []
      }
    ]

    const { error } = await supabaseAdmin
      .from('feedback_blocks')
      .insert(defaultBlocks)

    if (error) {
      console.error('[FeedbackSelector] Error creating default blocks:', error)
    }
  }

  /**
   * Delete a feedback module and its blocks
   */
  static async deleteModule(moduleId: string): Promise<{ success: boolean; error?: string }> {
    // Blocks are deleted via CASCADE, just delete the module
    const { error } = await supabaseAdmin
      .from('feedback_modules')
      .delete()
      .eq('id', moduleId)

    if (error) {
      console.error('[FeedbackSelector] Error deleting module:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
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
    // Get the module to find publication_id for IP exclusion
    const { data: module } = await supabaseAdmin
      .from('feedback_modules')
      .select('publication_id')
      .eq('id', moduleId)
      .single()

    // Fetch excluded IPs if we have a publication
    let exclusions: IPExclusion[] = []
    if (module?.publication_id) {
      const { data: excludedIpsData } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', module.publication_id)

      exclusions = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))
    }

    // Get all votes for this issue (include ip_address for filtering)
    const { data: allVotes, error } = await supabaseAdmin
      .from('feedback_votes')
      .select('selected_value, selected_label, subscriber_email, ip_address')
      .eq('feedback_module_id', moduleId)
      .eq('issue_id', issueId)

    if (error || !allVotes) {
      console.error('[FeedbackSelector] Error fetching votes:', error)
      return { total_votes: 0, breakdown: [], average_score: 0 }
    }

    // Filter out excluded IPs
    const votes = allVotes.filter(vote => !isIPExcluded(vote.ip_address, exclusions))

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

    // Find user's vote if email provided (check against unfiltered votes so user sees their own vote)
    let user_vote: { value: number; label: string } | undefined
    if (email) {
      const userVote = allVotes.find(v => v.subscriber_email.toLowerCase() === email.toLowerCase())
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

    // Fetch excluded IPs for this publication
    const { data: excludedIpsData } = await supabaseAdmin
      .from('excluded_ips')
      .select('ip_address, is_range, cidr_prefix')
      .eq('publication_id', publicationId)

    const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix
    }))

    // Build query for votes (include ip_address for filtering)
    let query = supabaseAdmin
      .from('feedback_votes')
      .select('issue_id, selected_value, selected_label, voted_at, ip_address')
      .eq('feedback_module_id', module.id)
      .not('issue_id', 'is', null)

    if (dateFrom) {
      query = query.gte('voted_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('voted_at', dateTo)
    }

    const { data: allVotes, error } = await query

    if (error || !allVotes) {
      console.error('[FeedbackSelector] Error fetching analytics:', error)
      return []
    }

    // Filter out excluded IPs
    const votes = allVotes.filter(vote => !isIPExcluded(vote.ip_address, exclusions))

    if (exclusions.length > 0) {
      const excludedCount = allVotes.length - votes.length
      if (excludedCount > 0) {
        console.log(`[FeedbackSelector] Filtered ${excludedCount} votes from excluded IPs`)
      }
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

    // Get issue dates from publication_issues table
    const issueIds = Array.from(new Set(votes.map(v => v.issue_id).filter(Boolean)))
    let issueDates: Record<string, string> = {}

    if (issueIds.length > 0) {
      const { data: issues } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date')
        .in('id', issueIds)

      if (issues) {
        issueDates = Object.fromEntries(issues.map(i => [i.id, i.date]))
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

  /**
   * Mark a comment as read for a user
   */
  static async markCommentAsRead(
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .upsert({
        comment_id: commentId,
        user_id: userId,
        read_at: new Date().toISOString()
      }, {
        onConflict: 'comment_id,user_id'
      })

    if (error) {
      console.error('[FeedbackSelector] Error marking comment as read:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Mark a comment as unread for a user
   */
  static async markCommentAsUnread(
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)

    if (error) {
      console.error('[FeedbackSelector] Error marking comment as unread:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Mark all comments as read for a user in a publication
   */
  static async markAllCommentsAsRead(
    publicationId: string,
    userId: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    // Get all unread comments for this publication
    const { data: comments, error: fetchError } = await supabaseAdmin
      .from('feedback_comments')
      .select('id')
      .eq('publication_id', publicationId)

    if (fetchError) {
      console.error('[FeedbackSelector] Error fetching comments for mark all:', fetchError)
      return { success: false, count: 0, error: fetchError.message }
    }

    if (!comments || comments.length === 0) {
      return { success: true, count: 0 }
    }

    // Insert read status for all comments (using upsert to avoid duplicates)
    const readStatuses = comments.map(c => ({
      comment_id: c.id,
      user_id: userId,
      read_at: new Date().toISOString()
    }))

    const { error } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .upsert(readStatuses, {
        onConflict: 'comment_id,user_id'
      })

    if (error) {
      console.error('[FeedbackSelector] Error marking all comments as read:', error)
      return { success: false, count: 0, error: error.message }
    }

    return { success: true, count: comments.length }
  }

  /**
   * Get unread comment count for a user in a publication
   */
  static async getUnreadCommentCount(
    publicationId: string,
    userId: string
  ): Promise<number> {
    // Get all comment IDs for this publication
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('feedback_comments')
      .select('id')
      .eq('publication_id', publicationId)

    if (commentsError || !comments) {
      console.error('[FeedbackSelector] Error fetching comments for unread count:', commentsError)
      return 0
    }

    if (comments.length === 0) {
      return 0
    }

    // Get read status for this user
    const { data: readStatuses, error: readError } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', comments.map(c => c.id))

    if (readError) {
      console.error('[FeedbackSelector] Error fetching read statuses:', readError)
      return comments.length // Assume all unread if we can't get status
    }

    const readCommentIds = new Set(readStatuses?.map(r => r.comment_id) || [])
    const unreadCount = comments.filter(c => !readCommentIds.has(c.id)).length

    return unreadCount
  }

  /**
   * Get total unread comment count (comments not read by any user)
   * Used when no user session is available (e.g., staging)
   */
  static async getTotalUnreadCommentCount(publicationId: string): Promise<number> {
    // Get all comment IDs for this publication
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('feedback_comments')
      .select('id')
      .eq('publication_id', publicationId)

    if (commentsError || !comments) {
      console.error('[FeedbackSelector] Error fetching comments for total unread count:', commentsError)
      return 0
    }

    if (comments.length === 0) {
      return 0
    }

    // Get all read statuses (any user)
    const { data: readStatuses, error: readError } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .select('comment_id')
      .in('comment_id', comments.map(c => c.id))

    if (readError) {
      console.error('[FeedbackSelector] Error fetching read statuses:', readError)
      return comments.length // Assume all unread if we can't get status
    }

    // Count comments that have no read status from any user
    const readCommentIds = new Set(readStatuses?.map(r => r.comment_id) || [])
    const unreadCount = comments.filter(c => !readCommentIds.has(c.id)).length

    return unreadCount
  }

  /**
   * Get read status for comments (returns set of read comment IDs)
   */
  static async getReadCommentIds(
    publicationId: string,
    userId: string
  ): Promise<Set<string>> {
    // Get all comment IDs for this publication
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('feedback_comments')
      .select('id')
      .eq('publication_id', publicationId)

    if (commentsError || !comments || comments.length === 0) {
      return new Set()
    }

    // Get read status for this user
    const { data: readStatuses, error: readError } = await supabaseAdmin
      .from('feedback_comment_read_status')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', comments.map(c => c.id))

    if (readError || !readStatuses) {
      return new Set()
    }

    return new Set(readStatuses.map(r => r.comment_id))
  }

  /**
   * Get recent comments with read status for dashboard
   */
  static async getRecentCommentsWithReadStatus(
    publicationId: string,
    userId: string,
    limit: number = 20
  ): Promise<Array<FeedbackComment & { vote?: FeedbackVote; is_read: boolean }>> {
    // Get comments
    const comments = await this.getRecentComments(publicationId, limit)

    if (comments.length === 0) {
      return []
    }

    // Get read statuses
    const readIds = await this.getReadCommentIds(publicationId, userId)

    return comments.map(c => ({
      ...c,
      is_read: readIds.has(c.id)
    }))
  }
}
