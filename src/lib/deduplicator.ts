import crypto from 'crypto'
import type { RssPost } from '@/types/database'
import { AI_PROMPTS, callOpenAI } from './openai'

/**
 * Multi-Stage Deduplication System
 *
 * Stage 1: Exact content hash matching (deterministic)
 * Stage 2: Title similarity matching using Jaccard (deterministic)
 * Stage 3: AI semantic analysis (contextual)
 */

export interface DuplicateGroup {
  topic_signature: string
  primary_post_index: number
  duplicate_indices: number[]
  detection_method: 'content_hash' | 'title_similarity' | 'ai_semantic'
  similarity_score: number
  explanation?: string
}

export interface DeduplicationResult {
  groups: DuplicateGroup[]
  stats: {
    total_posts: number
    unique_posts: number
    duplicate_posts: number
    exact_duplicates: number
    title_duplicates: number
    semantic_duplicates: number
  }
}

export class Deduplicator {
  private readonly TITLE_SIMILARITY_THRESHOLD = 0.80

  /**
   * Main orchestrator - runs all 3 stages
   */
  async detectAllDuplicates(posts: RssPost[]): Promise<DeduplicationResult> {
    if (posts.length < 2) {
      return {
        groups: [],
        stats: {
          total_posts: posts.length,
          unique_posts: posts.length,
          duplicate_posts: 0,
          exact_duplicates: 0,
          title_duplicates: 0,
          semantic_duplicates: 0
        }
      }
    }

    console.log(`[DEDUP] Starting 3-stage deduplication for ${posts.length} posts`)

    const allGroups: DuplicateGroup[] = []
    const markedAsDuplicate = new Set<number>()

    // Stage 1: Exact content hash
    const exactGroups = await this.detectExactDuplicates(posts)
    console.log(`[DEDUP] Stage 1: Found ${exactGroups.length} exact content matches`)

    for (const group of exactGroups) {
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
      console.log(`[DEDUP] Stage 2: Found ${titleGroups.length} title matches (>80% similar)`)

      for (const group of titleGroups) {
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
      console.log(`[DEDUP] Stage 3: AI identified ${semanticGroups.length} topic groups`)

      for (const group of semanticGroups) {
        allGroups.push(group)
        group.duplicate_indices.forEach(idx => markedAsDuplicate.add(idx))
      }
    }

    const totalDuplicates = markedAsDuplicate.size
    console.log(`[DEDUP] Total: ${allGroups.length} groups, ${totalDuplicates} posts marked as duplicates`)

    return {
      groups: allGroups,
      stats: {
        total_posts: posts.length,
        unique_posts: posts.length - totalDuplicates,
        duplicate_posts: totalDuplicates,
        exact_duplicates: exactGroups.reduce((sum, g) => sum + g.duplicate_indices.length, 0),
        title_duplicates: allGroups
          .filter(g => g.detection_method === 'title_similarity')
          .reduce((sum, g) => sum + g.duplicate_indices.length, 0),
        semantic_duplicates: allGroups
          .filter(g => g.detection_method === 'ai_semantic')
          .reduce((sum, g) => sum + g.duplicate_indices.length, 0)
      }
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

        if (similarity >= this.TITLE_SIMILARITY_THRESHOLD) {
          duplicates.push(j)
          processed.add(j)
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          topic_signature: `Title match: "${posts[i].title}"`,
          primary_post_index: originalIndices[i],
          duplicate_indices: duplicates.map(idx => originalIndices[idx]),
          detection_method: 'title_similarity',
          similarity_score: 0.85, // Average estimate
          explanation: `Titles are >80% similar`
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
      // Prepare post summaries with FULL article text
      const postSummaries = posts.map(post => ({
        title: post.title,
        description: post.description || '',
        full_article_text: post.full_article_text || post.content || ''
      }))

      const prompt = await AI_PROMPTS.topicDeduper(postSummaries)
      const result = await callOpenAI(prompt)

      if (!result.groups || result.groups.length === 0) {
        return []
      }

      // Map AI result indices back to original post indices
      return result.groups.map((group: any) => ({
        topic_signature: group.topic_signature,
        primary_post_index: originalIndices[group.primary_article_index],
        duplicate_indices: group.duplicate_indices.map((idx: number) => originalIndices[idx]),
        detection_method: 'ai_semantic' as const,
        similarity_score: 0.8, // Default for AI-detected
        explanation: group.similarity_explanation
      }))

    } catch (error) {
      console.error('[DEDUP] Stage 3 AI error:', error)
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
