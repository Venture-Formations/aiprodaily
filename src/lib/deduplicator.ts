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
 * Stage 3: AI semantic analysis (contextual)
 */

export interface DuplicateGroup {
  topic_signature: string
  primary_post_index: number
  duplicate_indices: number[]
  detection_method: 'historical_match' | 'content_hash' | 'title_similarity' | 'ai_semantic'
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
   * Main orchestrator - runs all 4 stages (0-3)
   */
  async detectAllDuplicates(posts: RssPost[], campaignId: string): Promise<DeduplicationResult> {
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
          semantic_duplicates: 0
        }
      }
    }

    const allGroups: DuplicateGroup[] = []
    const markedAsDuplicate = new Set<number>()

    const historicalGroups = await this.detectHistoricalDuplicates(posts, campaignId)

    for (const group of historicalGroups) {
      if (!group || !Array.isArray(group.duplicate_indices)) {
        continue
      }
      allGroups.push(group)
      group.duplicate_indices.forEach(idx => markedAsDuplicate.add(idx))
    }

    // Stage 1: Exact content hash (only remaining posts)
    const remainingAfterHistorical = posts.map((post, idx) => ({ post, idx }))
      .filter(({ idx }) => !markedAsDuplicate.has(idx))

    if (remainingAfterHistorical.length === 0) {
      const totalDuplicates = markedAsDuplicate.size
      // Helper function to safely get duplicate_indices length
      const getDuplicateCount = (g: DuplicateGroup): number => {
        return Array.isArray(g?.duplicate_indices) ? g.duplicate_indices.length : 0
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
          semantic_duplicates: 0
        }
      }
    }

    const exactGroups = await this.detectExactDuplicates(posts)

    for (const group of exactGroups) {
      if (!group || !Array.isArray(group.duplicate_indices)) {
        continue
      }
      allGroups.push(group)
      group.duplicate_indices.forEach(idx => markedAsDuplicate.add(idx))
    }

    // Stage 2: Title similarity (only check posts not already marked)
    const remainingPosts = posts.map((post, idx) => ({ post, idx }))
      .filter(({ idx }) => !markedAsDuplicate.has(idx))

    if (remainingPosts.length >= 2) {
      const titleGroups = await this.detectTitleDuplicates(
        remainingPosts.map(p => p.post),
        remainingPosts.map(p => p.idx)
      )

      for (const group of titleGroups) {
        if (!group || !Array.isArray(group.duplicate_indices)) {
          continue
        }
        allGroups.push(group)
        group.duplicate_indices.forEach(idx => markedAsDuplicate.add(idx))
      }
    }

    // Stage 3: AI semantic analysis (only check posts not already marked)
    const stillRemaining = posts.map((post, idx) => ({ post, idx }))
      .filter(({ idx }) => !markedAsDuplicate.has(idx))

    if (stillRemaining.length >= 2) {
      const semanticGroups = await this.detectSemanticDuplicates(
        stillRemaining.map(p => p.post),
        stillRemaining.map(p => p.idx)
      )

      if (Array.isArray(semanticGroups)) {
        for (const group of semanticGroups) {
          if (!group || !Array.isArray(group.duplicate_indices)) {
            continue
          }
          allGroups.push(group)
          group.duplicate_indices.forEach(idx => markedAsDuplicate.add(idx))
        }
      }
    }

    const totalDuplicates = markedAsDuplicate.size

    // Helper function to safely get duplicate_indices length
    const getDuplicateCount = (g: DuplicateGroup): number => {
      return Array.isArray(g?.duplicate_indices) ? g.duplicate_indices.length : 0
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
          .reduce((sum, g) => sum + getDuplicateCount(g), 0)
      }
    }
  }

  /**
   * Stage 0: Check against articles from recently sent newsletters
   */
  private async detectHistoricalDuplicates(posts: RssPost[], campaignId: string): Promise<DuplicateGroup[]> {
    try {
      // Get sent campaigns from last N days
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.historicalLookbackDays)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      const { data: recentCampaigns, error: campaignsError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id')
        .eq('status', 'sent')
        .gte('date', cutoffDateStr)
        .neq('id', campaignId) // Exclude current campaign

      if (campaignsError || !recentCampaigns || recentCampaigns.length === 0) {
        return []
      }

      const campaignIds = recentCampaigns.map(c => c.id)

      // Get all articles from those campaigns (only active ones that were included)
      const { data: historicalArticles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select('id, post_id, headline')
        .in('campaign_id', campaignIds)
        .eq('is_active', true)
        .eq('skipped', false)

      const { data: historicalSecondaryArticles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, post_id, headline')
        .in('campaign_id', campaignIds)
        .eq('is_active', true)
        .eq('skipped', false)

      const { data: historicalManualArticles } = await supabaseAdmin
        .from('manual_articles')
        .select('id, title, content')
        .in('campaign_id', campaignIds)
        .eq('is_active', true)

      if (articlesError) {
        console.error('[DEDUP] Error fetching historical articles:', articlesError)
        return []
      }

      // Get the RSS posts for historical articles
      const historicalPostIds = [
        ...(historicalArticles?.map(a => a.post_id).filter(Boolean) || []),
        ...(historicalSecondaryArticles?.map(a => a.post_id).filter(Boolean) || [])
      ]

      if (historicalPostIds.length === 0 && (!historicalManualArticles || historicalManualArticles.length === 0)) {
        return []
      }

      const { data: historicalPosts, error: postsError } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, content, full_article_text')
        .in('id', historicalPostIds)

      if (postsError) {
        console.error('[DEDUP] Error fetching historical posts:', postsError)
        return []
      }

      // Create hash map of historical content
      const historicalHashes = new Map<string, string>() // hash -> title for logging

      // Hash RSS posts
      for (const post of historicalPosts || []) {
        const hash = this.createContentHash(post as any)
        historicalHashes.set(hash, post.title)
      }

      // Hash manual articles
      for (const article of historicalManualArticles || []) {
        const hash = crypto.createHash('md5')
          .update((article.content || article.title).toLowerCase().replace(/\s+/g, ' '))
          .digest('hex')
        historicalHashes.set(hash, article.title)
      }

      // Check new posts against historical hashes
      const groups: DuplicateGroup[] = []
      const matchedIndices = new Set<number>()

      for (let i = 0; i < posts.length; i++) {
        if (matchedIndices.has(i)) continue

        const postHash = this.createContentHash(posts[i])

        if (historicalHashes.has(postHash)) {
          const historicalTitle = historicalHashes.get(postHash)!
          groups.push({
            topic_signature: `Historical match: Previously published "${historicalTitle.substring(0, 60)}..."`,
            primary_post_index: i,
            duplicate_indices: [i], // Mark this post as duplicate
            detection_method: 'historical_match',
            similarity_score: 1.0,
            explanation: `Article was already included in a newsletter within the last ${this.config.historicalLookbackDays} days`
          })
          matchedIndices.add(i)
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
    const hashMap = new Map<string, number[]>()

    for (let i = 0; i < posts.length; i++) {
      const hash = this.createContentHash(posts[i])
      if (!hashMap.has(hash)) {
        hashMap.set(hash, [])
      }
      hashMap.get(hash)!.push(i)
    }

    // Convert groups with 2+ posts into DuplicateGroup format
    const groups: DuplicateGroup[] = []

    for (const [hash, indices] of Array.from(hashMap.entries())) {
      if (indices.length >= 2) {
        // First index is primary, rest are duplicates
        const [primary, ...duplicates] = indices
        groups.push({
          topic_signature: `Exact content match (hash: ${hash.substring(0, 8)})`,
          primary_post_index: primary,
          duplicate_indices: duplicates,
          detection_method: 'content_hash',
          similarity_score: 1.0,
          explanation: 'Word-for-word identical content'
        })
      }
    }

    return groups
  }

  /**
   * Stage 2: Detect title duplicates using Jaccard similarity
   */
  private async detectTitleDuplicates(
    posts: RssPost[],
    originalIndices: number[]
  ): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = []
    const processed = new Set<number>()

    // Compare all pairs
    for (let i = 0; i < posts.length; i++) {
      if (processed.has(i)) continue

      const duplicates: number[] = []
      const title1 = this.normalizeTitle(posts[i].title)

      for (let j = i + 1; j < posts.length; j++) {
        if (processed.has(j)) continue

        const title2 = this.normalizeTitle(posts[j].title)
        const similarity = this.calculateJaccardSimilarity(title1, title2)

        if (similarity >= this.config.strictnessThreshold) {
          duplicates.push(j)
          processed.add(j)
        }
      }

      if (duplicates.length > 0) {
        const thresholdPercent = Math.round(this.config.strictnessThreshold * 100)
        groups.push({
          topic_signature: `Title match: "${posts[i].title}"`,
          primary_post_index: originalIndices[i],
          duplicate_indices: duplicates.map(idx => originalIndices[idx]),
          detection_method: 'title_similarity',
          similarity_score: this.config.strictnessThreshold + 0.05, // Slightly above threshold
          explanation: `Titles are >${thresholdPercent}% similar`
        })
        processed.add(i)
      }
    }

    return groups
  }

  /**
   * Stage 3: AI semantic analysis with full article text
   */
  private async detectSemanticDuplicates(
    posts: RssPost[],
    originalIndices: number[]
  ): Promise<DuplicateGroup[]> {
    try {
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return []
      }

      if (!originalIndices || !Array.isArray(originalIndices) || originalIndices.length !== posts.length) {
        return []
      }

      // Prepare post summaries with FULL article text
      const postSummaries = posts.map(post => ({
        title: post.title,
        description: post.description || '',
        full_article_text: post.full_article_text || post.content || ''
      }))

      const result = await AI_CALL.topicDeduper(postSummaries, 1000, 0.3)

      if (!result || typeof result !== 'object' || !Array.isArray(result.groups)) {
        return []
      }

      // Map AI result indices back to original post indices
      // IMPORTANT: AI returns indices relative to the filtered subset (stillRemaining)
      // originalIndices maps: subset_index -> original_full_array_index
      // Example: If subset is [post_5, post_12, post_20], then originalIndices = [5, 12, 20]
      // If AI returns index 1, that means post_12, and we map to originalIndices[1] = 12
      return result.groups
        .map((group: any) => {
          try {
            if (!group || typeof group !== 'object' || !Array.isArray(group.duplicate_indices)) {
              return null
            }

            const primaryIdx = typeof group.primary_article_index === 'number' 
              ? group.primary_article_index 
              : null

            // Validate primary index is within the filtered subset bounds
            if (primaryIdx === null || primaryIdx < 0 || primaryIdx >= originalIndices.length) {
              console.error(`[DEDUP] Invalid primary_article_index: ${primaryIdx} (subset length: ${originalIndices.length})`)
              return null
            }

            // Map duplicate indices - must be within the filtered subset bounds
            const mappedDuplicateIndices = group.duplicate_indices
              .map((idx: number) => {
                // Check bounds relative to the filtered subset (originalIndices length)
                if (typeof idx !== 'number' || idx < 0 || idx >= originalIndices.length) {
                  console.error(`[DEDUP] Invalid duplicate index: ${idx} (subset length: ${originalIndices.length})`)
                  return null
                }
                
                // Map from subset index to original full array index
                const originalIdx = originalIndices[idx]
                if (originalIdx === undefined || typeof originalIdx !== 'number') {
                  console.error(`[DEDUP] Failed to map duplicate index ${idx} to original index`)
                  return null
                }
                
                return originalIdx
              })
              .filter((idx: number | null): idx is number => idx !== null)

            if (mappedDuplicateIndices.length === 0) {
              console.error(`[DEDUP] No valid duplicate indices after mapping for group: ${group.topic_signature}`)
              return null
            }

            // Map primary index from subset to original full array index
            const mappedPrimaryIdx = originalIndices[primaryIdx]
            if (mappedPrimaryIdx === undefined || typeof mappedPrimaryIdx !== 'number') {
              console.error(`[DEDUP] Failed to map primary index ${primaryIdx} to original index`)
              return null
            }

            return {
              topic_signature: group.topic_signature || 'unknown',
              primary_post_index: mappedPrimaryIdx,
              duplicate_indices: mappedDuplicateIndices,
              detection_method: 'ai_semantic' as const,
              similarity_score: 0.8, // Default for AI-detected
              explanation: group.similarity_explanation || ''
            }
          } catch (error) {
            console.error(`[DEDUP] Error mapping semantic duplicate group:`, error)
            return null
          }
        })
        .filter(Boolean) as DuplicateGroup[]

    } catch {
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
