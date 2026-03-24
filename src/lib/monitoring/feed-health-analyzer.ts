import { supabaseAdmin } from '@/lib/supabase'
import { callAIWithPrompt } from '@/lib/openai/core'
import type { Logger } from 'pino'

/**
 * Feed Health Analyzer
 *
 * Generates AI-powered monitoring rules for RSS feeds based on
 * historical data (publishing cadence, extraction success rate,
 * article quality scores, post volume).
 *
 * Also evaluates existing rules against current feed data.
 */

export interface FeedHealthRule {
  id?: string
  feed_id: string
  rule_type: 'freshness' | 'quality' | 'extraction' | 'volume'
  description: string
  threshold_value: number
  threshold_unit: string
  baseline_value: number | null
}

export interface RuleEvaluation {
  ruleId: string
  feedId: string
  feedName: string
  ruleType: string
  description: string
  breached: boolean
  currentValue: number
  threshold: number
  unit: string
}

interface FeedStats {
  feedId: string
  feedName: string
  postCount: number
  avgScore: number | null
  extractionSuccessRate: number
  avgHoursBetweenPosts: number | null
  lastPostAt: string | null
  processingErrors: number
}

/** Inline fallback prompt */
const FALLBACK_PROMPT = JSON.stringify({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You analyze RSS feed health data and generate monitoring rules. For each feed with concerning patterns, generate rules. Return JSON array: [{"feed_id":"...","rule_type":"freshness|quality|extraction|volume","description":"...","threshold_value":0,"threshold_unit":"hours|percent|score|count","baseline_value":0}]. Only generate rules for feeds with clear anomalies or concerning trends.',
    },
    {
      role: 'user',
      content: 'Feed health data for last 7 days:\n{{feed_stats}}\n\nGenerate monitoring rules for feeds with concerning patterns.',
    },
  ],
  temperature: 0.3,
  max_tokens: 2000,
})

export class FeedHealthAnalyzer {
  constructor(
    private publicationId: string,
    private logger: Logger
  ) {}

  /**
   * Generate monitoring rules based on feed health data.
   * Replaces existing AI-generated rules; manual rules are preserved.
   */
  async generateRules(): Promise<FeedHealthRule[]> {
    const feedStats = await this.getFeedStats(7)

    if (feedStats.length === 0) {
      this.logger.info('[FeedHealth] No feeds to analyze')
      return []
    }

    // Format stats for AI
    const statsText = feedStats.map(f => [
      `Feed: ${f.feedName} (${f.feedId})`,
      `  Posts (7d): ${f.postCount}`,
      `  Avg score: ${f.avgScore?.toFixed(1) ?? 'N/A'}`,
      `  Extraction success: ${(f.extractionSuccessRate * 100).toFixed(0)}%`,
      `  Avg hours between posts: ${f.avgHoursBetweenPosts?.toFixed(1) ?? 'N/A'}`,
      `  Last post: ${f.lastPostAt || 'never'}`,
      `  Processing errors: ${f.processingErrors}`,
    ].join('\n')).join('\n\n')

    const aiResult = await callAIWithPrompt(
      'ai_feed_health_analysis',
      this.publicationId,
      { feed_stats: statsText },
      FALLBACK_PROMPT
    )

    const rules = this.parseRulesResponse(aiResult)

    if (rules.length > 0) {
      // Remove old AI-generated rules for this publication
      await supabaseAdmin
        .from('feed_health_rules')
        .delete()
        .eq('publication_id', this.publicationId)
        .eq('created_by', 'ai')

      // Insert new rules
      const rows = rules.map(r => ({
        publication_id: this.publicationId,
        feed_id: r.feed_id,
        rule_type: r.rule_type,
        description: r.description,
        threshold_value: r.threshold_value,
        threshold_unit: r.threshold_unit,
        baseline_value: r.baseline_value,
        is_active: true,
        created_by: 'ai' as const,
      }))

      const { error } = await supabaseAdmin
        .from('feed_health_rules')
        .insert(rows)

      if (error) {
        this.logger.error({ err: error }, '[FeedHealth] Failed to insert rules')
      }
    }

    this.logger.info({ rulesGenerated: rules.length }, '[FeedHealth] Rule generation complete')
    return rules
  }

  /**
   * Evaluate all active rules for this publication and return breached ones.
   */
  async evaluateRules(): Promise<RuleEvaluation[]> {
    const { data: rules } = await supabaseAdmin
      .from('feed_health_rules')
      .select('id, feed_id, rule_type, description, threshold_value, threshold_unit, baseline_value')
      .eq('publication_id', this.publicationId)
      .eq('is_active', true)

    if (!rules || rules.length === 0) return []

    const feedStats = await this.getFeedStats(7)
    const statsMap = new Map(feedStats.map(f => [f.feedId, f]))

    // Also need feed names
    const feedIds = Array.from(new Set(rules.map(r => r.feed_id)))
    const { data: feeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name')
      .in('id', feedIds)
    const feedNameMap = new Map((feeds || []).map(f => [f.id, f.name]))

    const evaluations: RuleEvaluation[] = []
    const now = new Date()

    for (const rule of rules) {
      const stats = statsMap.get(rule.feed_id)
      if (!stats) continue

      let currentValue: number
      let breached = false

      switch (rule.rule_type) {
        case 'freshness': {
          // threshold_unit = 'hours', threshold_value = max hours since last post
          if (!stats.lastPostAt) {
            currentValue = 999
            breached = true
          } else {
            const hoursSince = (now.getTime() - new Date(stats.lastPostAt).getTime()) / (1000 * 60 * 60)
            currentValue = Math.round(hoursSince * 10) / 10
            breached = currentValue > rule.threshold_value
          }
          break
        }
        case 'quality': {
          // threshold_unit = 'score', threshold_value = minimum avg score
          currentValue = stats.avgScore ?? 0
          breached = currentValue < rule.threshold_value
          break
        }
        case 'extraction': {
          // threshold_unit = 'percent', threshold_value = minimum success rate
          currentValue = Math.round(stats.extractionSuccessRate * 100)
          breached = currentValue < rule.threshold_value
          break
        }
        case 'volume': {
          // threshold_unit = 'count', threshold_value = minimum posts in 7 days
          currentValue = stats.postCount
          breached = currentValue < rule.threshold_value
          break
        }
        default:
          continue
      }

      // Update last_evaluated
      await supabaseAdmin
        .from('feed_health_rules')
        .update({
          last_evaluated: now.toISOString(),
          ...(breached ? { last_triggered: now.toISOString() } : {}),
        })
        .eq('id', rule.id)

      evaluations.push({
        ruleId: rule.id,
        feedId: rule.feed_id,
        feedName: feedNameMap.get(rule.feed_id) || rule.feed_id,
        ruleType: rule.rule_type,
        description: rule.description,
        breached,
        currentValue,
        threshold: rule.threshold_value,
        unit: rule.threshold_unit,
      })
    }

    return evaluations
  }

  /**
   * Gather feed statistics for the given number of days.
   */
  private async getFeedStats(days: number): Promise<FeedStats[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Get all active feeds for this publication
    const { data: feeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, processing_errors, last_processed')
      .eq('publication_id', this.publicationId)

    if (!feeds || feeds.length === 0) return []

    const feedIds = feeds.map(f => f.id)

    // Get posts from these feeds in the time range
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('feed_id, published_at, extraction_status')
      .in('feed_id', feedIds)
      .gte('published_at', since)

    // Get scores for these posts
    const { data: ratings } = await supabaseAdmin
      .from('post_ratings')
      .select('post_id, composite_score')
      .in('post_id', (posts || []).map((p: any) => p.id).filter(Boolean))

    const ratingMap = new Map((ratings || []).map((r: any) => [r.post_id, r.composite_score]))

    // Aggregate per feed
    return feeds.map(feed => {
      const feedPosts = (posts || []).filter((p: any) => p.feed_id === feed.id)
      const successPosts = feedPosts.filter((p: any) => p.extraction_status === 'success')
      const scores = feedPosts
        .map((p: any) => ratingMap.get(p.id))
        .filter((s: any): s is number => s != null)

      // Calculate avg hours between posts
      let avgHoursBetweenPosts: number | null = null
      if (feedPosts.length >= 2) {
        const sorted = feedPosts
          .map((p: any) => new Date(p.published_at).getTime())
          .sort((a: number, b: number) => a - b)
        const totalMs = sorted[sorted.length - 1] - sorted[0]
        avgHoursBetweenPosts = totalMs / (sorted.length - 1) / (1000 * 60 * 60)
      }

      return {
        feedId: feed.id,
        feedName: feed.name,
        postCount: feedPosts.length,
        avgScore: scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null,
        extractionSuccessRate: feedPosts.length > 0 ? successPosts.length / feedPosts.length : 1,
        avgHoursBetweenPosts,
        lastPostAt: feedPosts.length > 0
          ? feedPosts.sort((a: any, b: any) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0].published_at
          : null,
        processingErrors: feed.processing_errors || 0,
      }
    })
  }

  /**
   * Parse the AI response into an array of rules.
   */
  private parseRulesResponse(aiResult: any): FeedHealthRule[] {
    try {
      let parsed: any

      if (typeof aiResult === 'string') {
        const jsonMatch = aiResult.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return []
        parsed = JSON.parse(jsonMatch[0])
      } else if (typeof aiResult === 'object') {
        if (aiResult.raw) {
          const jsonMatch = aiResult.raw.match(/\[[\s\S]*\]/)
          if (!jsonMatch) return []
          parsed = JSON.parse(jsonMatch[0])
        } else if (Array.isArray(aiResult)) {
          parsed = aiResult
        } else {
          return []
        }
      } else {
        return []
      }

      if (!Array.isArray(parsed)) return []

      const validTypes = ['freshness', 'quality', 'extraction', 'volume']
      return parsed
        .filter((r: any) =>
          r.feed_id &&
          validTypes.includes(r.rule_type) &&
          typeof r.threshold_value === 'number' &&
          r.threshold_unit &&
          r.description
        )
        .map((r: any) => ({
          feed_id: r.feed_id,
          rule_type: r.rule_type,
          description: r.description,
          threshold_value: r.threshold_value,
          threshold_unit: r.threshold_unit,
          baseline_value: r.baseline_value ?? null,
        }))
    } catch {
      return []
    }
  }
}
