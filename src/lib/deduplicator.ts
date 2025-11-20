import crypto from 'crypto'
import type { RssPost } from '@/types/database'
import { AI_CALL } from './openai'
import { supabaseAdmin } from './supabase'

/**
 * Multi-Stage Deduplication System
 *
 * Stage 0: Historical article check (against sent newsletters)
 * Stage 1: Exact content hash matching (deterministic)
 * Stage 2: Title similarity matching using Jaccard (deterministic)
 * Stage 3: AI semantic analysis within sections (primary vs primary, secondary vs secondary)
 * Stage 4: AI cross-section semantic analysis (remaining primary vs remaining secondary)
 */

export interface DuplicateGroup {
  topic_signature: string
  primary_post_id: string  // Post ID instead of index
  duplicate_post_ids: string[]  // Post IDs instead of indices
  detection_method: 'historical_match' | 'content_hash' | 'title_similarity' | 'ai_semantic' | 'ai_cross_section'
  similarity_score: number
  explanation?: string
}

export interface DeduplicationResult {
  groups: DuplicateGroup[]
  stats: {
    total_posts: number
    unique_posts: number
    duplicate_posts: number
    historical_duplicates: number
    exact_duplicates: number
    title_duplicates: number
    semantic_duplicates: number
    cross_section_duplicates: number
  }
}

export interface DeduplicationConfig {
  strictnessThreshold: number  // 0.0-1.0, default 0.80
  historicalLookbackDays: number  // Default 3
}

export class Deduplicator {
  private readonly config: DeduplicationConfig

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = {
      strictnessThreshold: config?.strictnessThreshold ?? 0.80,
      historicalLookbackDays: config?.historicalLookbackDays ?? 3
    }
  }

  /**
   * Get publication_id from issue
   */
  private async getNewsletterIdFromissue(issueId: string): Promise<string> {
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
   * Main orchestrator - runs all 5 stages (0-4)
   */
  async detectAllDuplicates(posts: RssPost[], issueId: string): Promise<DeduplicationResult> {
    if (posts.length === 0) {
      return {
        groups: [],
        stats: {
          total_posts: 0,
          unique_posts: 0,
          duplicate_posts: 0,
          historical_duplicates: 0,
          exact_duplicates: 0,
          title_duplicates: 0,
          semantic_duplicates: 0,
          cross_section_duplicates: 0
        }
      }
    }

    const allGroups: DuplicateGroup[] = []
    const markedAsDuplicate = new Set<string>()  // Now tracking post IDs

    // Fetch ALL historical posts for Stages 0-2 (hash + title checks)
    // Stage 3 (AI semantic) will fetch section-specific historical posts
    const primaryHistorical = await this.fetchHistoricalPosts(issueId, 'primary')
    const secondaryHistorical = await this.fetchHistoricalPosts(issueId, 'secondary')
    const historicalPosts = [...primaryHistorical, ...secondaryHistorical]
    console.log(`[DEDUP] Fetched ${historicalPosts.length} historical posts (${primaryHistorical.length} primary, ${secondaryHistorical.length} secondary)`)

    // Stage 0: Historical duplicates (hash-based)
    const historicalGroups = await this.detectHistoricalDuplicates(posts, historicalPosts)

    for (const group of historicalGroups) {
      if (!group || !Array.isArray(group.duplicate_post_ids)) {
        continue
      }
      allGroups.push(group)
      group.duplicate_post_ids.forEach(id => markedAsDuplicate.add(id))
    }

    // Stage 1: Exact content hash (only remaining posts)
    const remainingAfterHistorical = posts.filter(post => !markedAsDuplicate.has(post.id))

    if (remainingAfterHistorical.length === 0) {
      const totalDuplicates = markedAsDuplicate.size
      const getDuplicateCount = (g: DuplicateGroup): number => {
        return Array.isArray(g?.duplicate_post_ids) ? g.duplicate_post_ids.length : 0
      }
      return {
        groups: allGroups,
        stats: {
          total_posts: posts.length,
          unique_posts: posts.length - totalDuplicates,
          duplicate_posts: totalDuplicates,
          historical_duplicates: historicalGroups.reduce((sum, g) => sum + getDuplicateCount(g), 0),
          exact_duplicates: 0,
          title_duplicates: 0,
          semantic_duplicates: 0,
          cross_section_duplicates: 0
        }
      }
    }

    // Stage 1: Exact hash duplicates
    const exactGroups = await this.detectExactDuplicates(remainingAfterHistorical)

    for (const group of exactGroups) {
      if (!group || !Array.isArray(group.duplicate_post_ids)) {
        continue
      }
      allGroups.push(group)
      group.duplicate_post_ids.forEach(id => markedAsDuplicate.add(id))
    }

    // Stage 2: Title similarity (check against both current posts and historical posts)
    const remainingAfterExact = posts.filter(post => !markedAsDuplicate.has(post.id))

    if (remainingAfterExact.length >= 1) {
      const titleGroups = await this.detectTitleDuplicates(
        remainingAfterExact,
        historicalPosts
      )

      for (const group of titleGroups) {
        if (!group || !Array.isArray(group.duplicate_post_ids)) {
          continue
        }
        allGroups.push(group)
        group.duplicate_post_ids.forEach(id => markedAsDuplicate.add(id))
      }
    }

    // Stage 3: AI semantic analysis (check against both current posts and historical posts)
    const remainingAfterTitle = posts.filter(post => !markedAsDuplicate.has(post.id))

    if (remainingAfterTitle.length >= 1) {
      const semanticGroups = await this.detectSemanticDuplicates(
        remainingAfterTitle,
        issueId,
        historicalPosts
      )

      if (Array.isArray(semanticGroups)) {
        for (const group of semanticGroups) {
          if (!group || !Array.isArray(group.duplicate_post_ids)) {
            continue
          }
          allGroups.push(group)
          group.duplicate_post_ids.forEach(id => markedAsDuplicate.add(id))
        }
      }
    }

    // Stage 4: AI cross-section semantic analysis (remaining primary vs remaining secondary)
    const remainingAfterSemantic = posts.filter(post => !markedAsDuplicate.has(post.id))

    if (remainingAfterSemantic.length >= 2) {
      const crossSectionGroups = await this.detectCrossSectionDuplicates(
        remainingAfterSemantic,
        issueId
      )

      if (Array.isArray(crossSectionGroups)) {
        for (const group of crossSectionGroups) {
          if (!group || !Array.isArray(group.duplicate_post_ids)) {
            continue
          }
          allGroups.push(group)
          group.duplicate_post_ids.forEach(id => markedAsDuplicate.add(id))
        }
      }
    }

    const totalDuplicates = markedAsDuplicate.size

    const getDuplicateCount = (g: DuplicateGroup): number => {
      return Array.isArray(g?.duplicate_post_ids) ? g.duplicate_post_ids.length : 0
    }

    return {
      groups: allGroups,
      stats: {
        total_posts: posts.length,
        unique_posts: posts.length - totalDuplicates,
        duplicate_posts: totalDuplicates,
        historical_duplicates: historicalGroups.reduce((sum, g) => sum + getDuplicateCount(g), 0),
        exact_duplicates: exactGroups.reduce((sum, g) => sum + getDuplicateCount(g), 0),
        title_duplicates: allGroups
          .filter(g => g.detection_method === 'title_similarity')
          .reduce((sum, g) => sum + getDuplicateCount(g), 0),
        semantic_duplicates: allGroups
          .filter(g => g.detection_method === 'ai_semantic')
          .reduce((sum, g) => sum + getDuplicateCount(g), 0),
        cross_section_duplicates: allGroups
          .filter(g => g.detection_method === 'ai_cross_section')
          .reduce((sum, g) => sum + getDuplicateCount(g), 0)
      }
    }
  }

  /**
   * Fetch historical posts from recently sent newsletters
   * @param section - 'primary' or 'secondary' to fetch section-specific articles
   */
  private async fetchHistoricalPosts(issueId: string, section: 'primary' | 'secondary'): Promise<RssPost[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.historicalLookbackDays)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      const { data: recentCampaigns, error: issuesError } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('status', 'sent')
        .gte('date', cutoffDateStr)
        .neq('id', issueId)

      if (issuesError || !recentCampaigns || recentCampaigns.length === 0) {
        return []
      }

      const issueIds = recentCampaigns.map(c => c.id)

      // Get ONLY articles from the specified section
      const tableName = section === 'primary' ? 'articles' : 'secondary_articles'
      const { data: historicalArticles, error: articlesError } = await supabaseAdmin
        .from(tableName)
        .select('id, post_id, headline')
        .in('issue_id', issueIds)
        .eq('is_active', true)
        .eq('skipped', false)

      if (articlesError) {
        console.error(`[DEDUP] Error fetching historical ${section} articles:`, articlesError)
        return []
      }

      // Get the RSS posts for historical articles
      const historicalPostIds = historicalArticles?.map(a => a.post_id).filter(Boolean) || []

      if (historicalPostIds.length === 0) {
        return []
      }

      const { data: historicalPosts, error: postsError } = await supabaseAdmin
        .from('rss_posts')
        .select('*')
        .in('id', historicalPostIds)

      if (postsError) {
        console.error(`[DEDUP] Error fetching historical ${section} posts:`, postsError)
        return []
      }

      return historicalPosts || []
    } catch (error) {
      console.error(`[DEDUP] Error in fetchHistoricalPosts (${section}):`, error)
      return []
    }
  }

  /**
   * Stage 0: Check against articles from recently sent newsletters (using hash)
   */
  private async detectHistoricalDuplicates(posts: RssPost[], historicalPosts: RssPost[]): Promise<DuplicateGroup[]> {
    try {
      if (historicalPosts.length === 0) {
        return []
      }

      // Create hash map of historical content (hash -> historical post)
      const historicalHashes = new Map<string, RssPost>()

      for (const post of historicalPosts) {
        const hash = this.createContentHash(post)
        historicalHashes.set(hash, post)
      }

      // Check current posts against historical hashes
      const groups: DuplicateGroup[] = []
      const matchedPostIds = new Set<string>()

      for (const post of posts) {
        if (matchedPostIds.has(post.id)) continue

        const postHash = this.createContentHash(post)

        if (historicalHashes.has(postHash)) {
          const historicalPost = historicalHashes.get(postHash)!
          groups.push({
            topic_signature: `Historical match: Previously published "${historicalPost.title.substring(0, 60)}..."`,
            primary_post_id: post.id,
            duplicate_post_ids: [post.id], // Mark this post as duplicate
            detection_method: 'historical_match',
            similarity_score: 1.0,
            explanation: `Article was already included in a newsletter within the last ${this.config.historicalLookbackDays} days`
          })
          matchedPostIds.add(post.id)
        }
      }

      return groups

    } catch (error) {
      console.error('[DEDUP] Error in historical duplicate detection:', error)
      return []
    }
  }

  /**
   * Stage 1: Detect exact content duplicates using MD5 hash
   */
  private async detectExactDuplicates(posts: RssPost[]): Promise<DuplicateGroup[]> {
    const hashMap = new Map<string, RssPost[]>()

    for (const post of posts) {
      const hash = this.createContentHash(post)
      if (!hashMap.has(hash)) {
        hashMap.set(hash, [])
      }
      hashMap.get(hash)!.push(post)
    }

    // Convert groups with 2+ posts into DuplicateGroup format
    const groups: DuplicateGroup[] = []

    for (const [hash, postsWithSameHash] of Array.from(hashMap.entries())) {
      if (postsWithSameHash.length >= 2) {
        // First post is primary, rest are duplicates
        const [primary, ...duplicates] = postsWithSameHash
        groups.push({
          topic_signature: `Exact content match: "${primary.title.substring(0, 60)}..."`,
          primary_post_id: primary.id,
          duplicate_post_ids: duplicates.map(p => p.id),
          detection_method: 'content_hash',
          similarity_score: 1.0,
          explanation: 'Word-for-word identical content'
        })
      }
    }

    return groups
  }

  /**
   * Stage 2: Detect title duplicates using Jaccard similarity (current vs current AND current vs historical)
   */
  private async detectTitleDuplicates(
    posts: RssPost[],
    historicalPosts: RssPost[]
  ): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = []
    const processed = new Set<string>() // Track by post ID

    // FIRST: Check current posts against historical posts
    for (const post of posts) {
      if (processed.has(post.id)) continue

      const title1 = this.normalizeTitle(post.title)

      for (const historicalPost of historicalPosts) {
        const title2 = this.normalizeTitle(historicalPost.title)
        const similarity = this.calculateJaccardSimilarity(title1, title2)

        if (similarity >= this.config.strictnessThreshold) {
          const thresholdPercent = Math.round(this.config.strictnessThreshold * 100)
          groups.push({
            topic_signature: `Historical title match: "${historicalPost.title.substring(0, 60)}..."`,
            primary_post_id: post.id,
            duplicate_post_ids: [post.id], // Mark current post as duplicate
            detection_method: 'title_similarity',
            similarity_score: similarity,
            explanation: `Title is ${Math.round(similarity * 100)}% similar to previously published article (threshold: ${thresholdPercent}%)`
          })
          processed.add(post.id)
          break // Stop checking other historical posts for this current post
        }
      }
    }

    // SECOND: Compare current posts with each other (within-issue duplicates)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      if (processed.has(post.id)) continue

      const duplicateIds: string[] = []
      const title1 = this.normalizeTitle(post.title)

      for (let j = i + 1; j < posts.length; j++) {
        const otherPost = posts[j]
        if (processed.has(otherPost.id)) continue

        const title2 = this.normalizeTitle(otherPost.title)
        const similarity = this.calculateJaccardSimilarity(title1, title2)

        if (similarity >= this.config.strictnessThreshold) {
          duplicateIds.push(otherPost.id)
          processed.add(otherPost.id)
        }
      }

      if (duplicateIds.length > 0) {
        const thresholdPercent = Math.round(this.config.strictnessThreshold * 100)
        groups.push({
          topic_signature: `Title match: "${post.title.substring(0, 60)}..."`,
          primary_post_id: post.id,
          duplicate_post_ids: duplicateIds,
          detection_method: 'title_similarity',
          similarity_score: this.config.strictnessThreshold + 0.05, // Slightly above threshold
          explanation: `Titles are >${thresholdPercent}% similar`
        })
        processed.add(post.id)
      }
    }

    return groups
  }

  /**
   * Stage 3: AI semantic analysis with full article text (current vs current AND current vs historical)
   * Split into TWO calls: primary section posts vs primary historical, secondary vs secondary historical
   */
  private async detectSemanticDuplicates(
    posts: RssPost[],
    issueId: string,
    historicalPosts: RssPost[]
  ): Promise<DuplicateGroup[]> {
    try {
      if (!posts || posts.length === 0) {
        return []
      }

      // Fetch feeds for all current posts to determine primary vs secondary
      const feedIds = Array.from(new Set(posts.map(p => p.feed_id).filter(Boolean)))
      const { data: feeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id, use_for_primary_section, use_for_secondary_section')
        .in('id', feedIds)

      const feedMap = new Map(feeds?.map(f => [f.id, f]) || [])

      // Split posts by feed type
      const primaryPosts = posts.filter(p => {
        const feed = feedMap.get(p.feed_id)
        return feed?.use_for_primary_section
      })

      const secondaryPosts = posts.filter(p => {
        const feed = feedMap.get(p.feed_id)
        return feed?.use_for_secondary_section
      })

      console.log(`[DEDUP] AI Semantic: Split ${posts.length} posts -> ${primaryPosts.length} primary, ${secondaryPosts.length} secondary`)

      // Fetch section-specific historical posts
      const primaryHistorical = await this.fetchHistoricalPosts(issueId, 'primary')
      const secondaryHistorical = await this.fetchHistoricalPosts(issueId, 'secondary')

      console.log(`[DEDUP] AI Semantic: Fetched ${primaryHistorical.length} primary historical, ${secondaryHistorical.length} secondary historical`)

      // Get publication_id for AI calls
      const newsletterId = await this.getNewsletterIdFromissue(issueId)

      // Run AI deduplication for primary posts against primary historical
      const primaryGroups = primaryPosts.length > 0
        ? await this.runSemanticDeduplicationBatch(primaryPosts, primaryHistorical, newsletterId, 'primary')
        : []

      // Run AI deduplication for secondary posts against secondary historical
      const secondaryGroups = secondaryPosts.length > 0
        ? await this.runSemanticDeduplicationBatch(secondaryPosts, secondaryHistorical, newsletterId, 'secondary')
        : []

      // Merge results
      return [...primaryGroups, ...secondaryGroups]

    } catch (error) {
      console.error('[DEDUP] AI Semantic error:', error)
      return []
    }
  }

  /**
   * Helper: Run AI deduplication for a batch of posts
   */
  private async runSemanticDeduplicationBatch(
    posts: RssPost[],
    historicalPosts: RssPost[],
    newsletterId: string,
    batchType: 'primary' | 'secondary'
  ): Promise<DuplicateGroup[]> {
    // Combine current posts + limited historical posts for AI analysis
    // Structure: [current posts..., historical posts...]
    const currentPostCount = posts.length
    const combinedPosts = [...posts, ...historicalPosts]

    // Prepare post summaries with FULL article text
    const postSummaries = combinedPosts.map(post => ({
      title: post.title,
      description: post.description || '',
      full_article_text: post.full_article_text || post.content || ''
    }))

    console.log(`[DEDUP] AI Semantic (${batchType}): Analyzing ${currentPostCount} current + ${historicalPosts.length} historical = ${postSummaries.length} total posts`)

    let result
    try {
      result = await AI_CALL.topicDeduper(postSummaries, newsletterId, 1000, 0.3)

      // Handle raw JSON string response
      if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
        console.log(`[DEDUP] AI Semantic (${batchType}): Parsing raw JSON response`)
        result = JSON.parse(result.raw)
      }

      console.log(`[DEDUP] AI Semantic (${batchType}): Received result with ${result?.groups?.length || 0} groups`)
    } catch (error) {
      console.error(`[DEDUP] AI Semantic (${batchType}): Error calling AI:`, error)
      return []
    }

    if (!result || typeof result !== 'object' || !Array.isArray(result.groups)) {
      console.error(`[DEDUP] AI Semantic (${batchType}): Invalid result format:`, result)
      return []
    }

    // Process AI results - convert indices to post IDs
    const groups: DuplicateGroup[] = []
    const currentPostIds = new Set(posts.map(p => p.id))

    console.log(`[DEDUP] AI Semantic (${batchType}): Processing ${result.groups.length} groups...`)

    for (const group of result.groups) {
      try {
        if (!group || typeof group !== 'object' || !Array.isArray(group.duplicate_indices)) {
          console.log(`[DEDUP] AI Semantic (${batchType}): Skipping invalid group structure`)
          continue
        }

        const primaryIdx = typeof group.primary_article_index === 'number'
          ? group.primary_article_index
          : null

        if (primaryIdx === null || primaryIdx < 0 || primaryIdx >= combinedPosts.length) {
          console.error(`[DEDUP] AI Semantic (${batchType}): Invalid primary_article_index ${primaryIdx} (combinedPosts.length=${combinedPosts.length})`)
          continue
        }

        const primaryPost = combinedPosts[primaryIdx]
        const isPrimaryHistorical = !currentPostIds.has(primaryPost.id)

        // Get all duplicate post IDs (only current posts should be marked)
        const duplicatePostIds = group.duplicate_indices
          .filter((idx: number) => typeof idx === 'number' && idx >= 0 && idx < combinedPosts.length)
          .map((idx: number) => combinedPosts[idx].id)
          .filter((id: string) => currentPostIds.has(id)) // Only current posts

        console.log(`[DEDUP] AI Semantic (${batchType}): Group "${group.topic_signature?.substring(0, 40)}..." - Primary idx ${primaryIdx} (historical: ${isPrimaryHistorical}), ${group.duplicate_indices.length} duplicates -> ${duplicatePostIds.length} current posts`)

        if (duplicatePostIds.length === 0) {
          // Check if primary is current and matches historical posts
          if (!isPrimaryHistorical) {
            // Primary is current but all its duplicates are historical
            // This is a historical match - mark the current primary as duplicate
            groups.push({
              topic_signature: `Historical AI match: "${primaryPost.title.substring(0, 60)}..."`,
              primary_post_id: primaryPost.id,
              duplicate_post_ids: [primaryPost.id],  // Mark the primary itself as duplicate
              detection_method: 'ai_semantic',
              similarity_score: 0.8,
              explanation: `AI detected semantic similarity to previously published article: ${group.similarity_explanation || ''}`
            })
            console.log(`[DEDUP] AI Semantic (${batchType}): Added historical match group - current primary ${primaryPost.id} matches historical posts`)
          } else {
            // Primary is historical, duplicates are historical - nothing to mark
            console.log(`[DEDUP] AI Semantic (${batchType}): Skipping group - no current posts in duplicates`)
          }
          continue
        }

        // Create duplicate group
        if (isPrimaryHistorical) {
          // Primary is historical - mark ALL current posts as duplicates
          // Use first current duplicate as primary, include ALL in duplicate_post_ids (same pattern as Stages 0 & 2)
          const newPrimaryId = duplicatePostIds[0]

          groups.push({
            topic_signature: `Historical AI match: "${primaryPost.title.substring(0, 60)}..."`,
            primary_post_id: newPrimaryId,
            duplicate_post_ids: duplicatePostIds,  // Include ALL current posts, including the primary
            detection_method: 'ai_semantic',
            similarity_score: 0.8,
            explanation: `AI detected semantic similarity to previously published article: ${group.similarity_explanation || ''}`
          })
          console.log(`[DEDUP] AI Semantic (${batchType}): Added historical match group - primary: ${newPrimaryId}, ${duplicatePostIds.length} duplicates`)
        } else {
          // Primary is current - mark as duplicate group within current issue
          groups.push({
            topic_signature: group.topic_signature || 'unknown',
            primary_post_id: primaryPost.id,
            duplicate_post_ids: duplicatePostIds,
            detection_method: 'ai_semantic',
            similarity_score: 0.8,
            explanation: group.similarity_explanation || ''
          })
          console.log(`[DEDUP] AI Semantic (${batchType}): Added current match group with ${duplicatePostIds.length} duplicates`)
        }
      } catch (error) {
        console.error(`[DEDUP] AI Semantic (${batchType}): Error mapping group:`, error)
      }
    }

    console.log(`[DEDUP] AI Semantic (${batchType}): Returning ${groups.length} groups`)
    return groups
  }

  /**
   * Stage 4: AI cross-section semantic analysis
   * Compares remaining primary posts vs remaining secondary posts
   * No historical comparison - just the current posts that survived Stages 0-3
   */
  private async detectCrossSectionDuplicates(
    posts: RssPost[],
    issueId: string
  ): Promise<DuplicateGroup[]> {
    try {
      if (!posts || posts.length < 2) {
        return []
      }

      // Fetch feeds to determine which posts are primary vs secondary
      const feedIds = Array.from(new Set(posts.map(p => p.feed_id).filter(Boolean)))
      const { data: feeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id, use_for_primary_section, use_for_secondary_section')
        .in('id', feedIds)

      const feedMap = new Map(feeds?.map(f => [f.id, f]) || [])

      // Split posts by section
      const primaryPosts = posts.filter(p => {
        const feed = feedMap.get(p.feed_id)
        return feed?.use_for_primary_section
      })

      const secondaryPosts = posts.filter(p => {
        const feed = feedMap.get(p.feed_id)
        return feed?.use_for_secondary_section
      })

      console.log(`[DEDUP] Cross-Section: ${primaryPosts.length} primary, ${secondaryPosts.length} secondary remaining posts`)

      // Only run if we have posts from BOTH sections
      if (primaryPosts.length === 0 || secondaryPosts.length === 0) {
        console.log(`[DEDUP] Cross-Section: Skipping - need posts from both sections`)
        return []
      }

      // Combine all remaining posts for cross-section comparison
      const allPosts = [...primaryPosts, ...secondaryPosts]

      // Prepare post summaries with FULL article text
      const postSummaries = allPosts.map(post => ({
        title: post.title,
        description: post.description || '',
        full_article_text: post.full_article_text || post.content || ''
      }))

      console.log(`[DEDUP] Cross-Section: Running AI on ${allPosts.length} posts (${primaryPosts.length} primary + ${secondaryPosts.length} secondary)`)

      // Get publication_id for AI call
      const newsletterId = await this.getNewsletterIdFromissue(issueId)

      // Run AI deduplication
      let result
      try {
        result = await AI_CALL.topicDeduper(postSummaries, newsletterId, 1000, 0.3)

        // Handle raw JSON string response
        if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
          console.log(`[DEDUP] Cross-Section: Parsing raw JSON response`)
          result = JSON.parse(result.raw)
        }

        console.log(`[DEDUP] Cross-Section: Received result with ${result?.groups?.length || 0} groups`)
      } catch (error) {
        console.error(`[DEDUP] Cross-Section: Error calling AI:`, error)
        return []
      }

      if (!result || typeof result !== 'object' || !Array.isArray(result.groups)) {
        console.error(`[DEDUP] Cross-Section: Invalid result format:`, result)
        return []
      }

      // Process AI results - convert indices to post IDs
      const groups: DuplicateGroup[] = []

      console.log(`[DEDUP] Cross-Section: Processing ${result.groups.length} groups...`)

      for (const group of result.groups) {
        try {
          if (!group || typeof group !== 'object' || !Array.isArray(group.duplicate_indices)) {
            console.log(`[DEDUP] Cross-Section: Skipping invalid group structure`)
            continue
          }

          const primaryIdx = typeof group.primary_article_index === 'number'
            ? group.primary_article_index
            : null

          if (primaryIdx === null || primaryIdx < 0 || primaryIdx >= allPosts.length) {
            console.error(`[DEDUP] Cross-Section: Invalid primary_article_index ${primaryIdx} (allPosts.length=${allPosts.length})`)
            continue
          }

          const primaryPost = allPosts[primaryIdx]

          // Get all duplicate post IDs
          const duplicatePostIds = group.duplicate_indices
            .filter((idx: number) => typeof idx === 'number' && idx >= 0 && idx < allPosts.length)
            .map((idx: number) => allPosts[idx].id)
            .filter((id: string) => id !== primaryPost.id) // Exclude primary from duplicates

          console.log(`[DEDUP] Cross-Section: Group "${group.topic_signature?.substring(0, 40)}..." - Primary idx ${primaryIdx}, ${duplicatePostIds.length} duplicates`)

          if (duplicatePostIds.length === 0) {
            console.log(`[DEDUP] Cross-Section: Skipping group - no duplicates besides primary`)
            continue
          }

          // Create duplicate group with cross-section detection method
          groups.push({
            topic_signature: group.topic_signature || 'Cross-section duplicate',
            primary_post_id: primaryPost.id,
            duplicate_post_ids: duplicatePostIds,
            detection_method: 'ai_cross_section',
            similarity_score: 0.8,
            explanation: group.similarity_explanation || 'Similar story detected across primary and secondary sections'
          })

          console.log(`[DEDUP] Cross-Section: Added group - primary: ${primaryPost.id}, ${duplicatePostIds.length} duplicates`)
        } catch (error) {
          console.error(`[DEDUP] Cross-Section: Error mapping group:`, error)
        }
      }

      console.log(`[DEDUP] Cross-Section: Returning ${groups.length} groups`)
      return groups

    } catch (error) {
      console.error('[DEDUP] Cross-Section error:', error)
      return []
    }
  }

  /**
   * Create content hash from full_article_text > content > description
   */
  private createContentHash(post: RssPost): string {
    const content = (
      post.full_article_text ||
      post.content ||
      post.description ||
      ''
    ).trim().toLowerCase()

    // Normalize whitespace
    const normalized = content.replace(/\s+/g, ' ')

    if (normalized.length === 0) {
      // If no content, use title as fallback
      return crypto.createHash('md5').update(post.title.toLowerCase()).digest('hex')
    }

    return crypto.createHash('md5').update(normalized).digest('hex')
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Calculate Jaccard similarity between two titles (word-set comparison)
   */
  private calculateJaccardSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.split(' ').filter(w => w.length > 0))
    const words2 = new Set(title2.split(' ').filter(w => w.length > 0))

    if (words1.size === 0 && words2.size === 0) return 1.0
    if (words1.size === 0 || words2.size === 0) return 0.0

    const words1Array = Array.from(words1)
    const words2Array = Array.from(words2)

    const intersection = new Set(words1Array.filter(w => words2.has(w)))
    const union = new Set([...words1Array, ...words2Array])

    return intersection.size / union.size
  }
}
