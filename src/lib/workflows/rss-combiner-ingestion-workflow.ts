/**
 * RSS Combiner Ingestion Workflow
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit.
 *
 * Splits the monolithic runIngestion() into discrete steps so a single
 * ingestion run (especially with 70+ trades) doesn't hit the single-function
 * 600s API route limit.
 *
 * Steps:
 *   1. Load context (settings, approved sources, excluded keywords, top trades)
 *   2. Primary RSS fetch + upsert
 *   3. Secondary RSS fetch (for trades below min_posts_per_trade, if enabled)
 *   4. Feed-window image generation (for all tickers in feed output missing images)
 *   5. Finalize (update last_ingestion_at, invalidate cache)
 *
 * Note: Image generation runs AFTER fetching so the feed-window step covers
 * every ticker appearing in the combined feed output, not just the current
 * top trades. The primary fetch pass does not use trade.image_url, so there
 * is no functional reason to generate images before fetching.
 */

export interface IngestionWorkflowInput {
  trigger: 'cron' | 'manual'
}

export interface IngestionStats {
  feedsFetched: number
  feedsFailed: number
  articlesStored: number
  articlesFiltered: number
  articlesSkippedDuplicate: number
}

export async function rssCombinerIngestionWorkflow(
  input: IngestionWorkflowInput
): Promise<{ success: boolean; stats: IngestionStats }> {
  "use workflow"

  console.log(`[Combiner Workflow] Starting (trigger: ${input.trigger})`)

  // Step 1: Load context
  const ctx = await loadIngestionContext()
  console.log(`[Combiner Workflow] Loaded ${ctx.trades.length} top trades`)

  // Note: primary image generation is handled by feedWindowImageGeneration
  // (step 4 below). That step covers all tickers appearing in the combined
  // feed output, which is a superset of the current top trades. Running
  // image generation twice (once before RSS fetch, once after) is redundant
  // and caused the workflow to hang — @vercel/og / payload serialization
  // issues between steps. The primary fetch pass does NOT use trade.image_url,
  // so we skip image generation here entirely.

  // Step 2: Primary RSS fetch + upsert
  console.log(`[Combiner Workflow] Starting primary RSS fetch`)
  const primaryStats = await primaryFetchPass({
    trades: ctx.trades,
    saleTemplate: ctx.saleTemplate,
    purchaseTemplate: ctx.purchaseTemplate,
    maxAgeDays: ctx.maxAgeDays,
    approvedDomains: ctx.approvedDomains,
    excludedKeywords: ctx.excludedKeywords,
  })
  console.log(`[Combiner Workflow] Primary fetch complete: ${primaryStats.articlesStored} stored`)

  // Step 4: Secondary RSS fetch (if enabled + templates configured)
  let secondaryStats: IngestionStats = {
    feedsFetched: 0,
    feedsFailed: 0,
    articlesStored: 0,
    articlesFiltered: 0,
    articlesSkippedDuplicate: 0,
  }
  if (ctx.secondaryTemplatesEnabled && (ctx.secondarySaleTemplate || ctx.secondaryPurchaseTemplate)) {
    console.log(`[Combiner Workflow] Starting secondary RSS fetch`)
    secondaryStats = await secondaryFetchPass({
      trades: ctx.trades,
      secondarySaleTemplate: ctx.secondarySaleTemplate,
      secondaryPurchaseTemplate: ctx.secondaryPurchaseTemplate,
      minPostsPerTrade: ctx.minPostsPerTrade,
      maxAgeDays: ctx.maxAgeDays,
      approvedDomains: ctx.approvedDomains,
      excludedKeywords: ctx.excludedKeywords,
    })
    console.log(`[Combiner Workflow] Secondary fetch complete: ${secondaryStats.articlesStored} stored`)
  }

  // Step 4: Generate trade card images for all tickers in the feed window
  console.log(`[Combiner Workflow] Starting feed-window image generation`)
  await feedWindowImageGeneration()
  console.log(`[Combiner Workflow] Image generation complete`)

  // Step 5: Finalize
  await finalizeIngestion()

  const stats: IngestionStats = {
    feedsFetched: primaryStats.feedsFetched + secondaryStats.feedsFetched,
    feedsFailed: primaryStats.feedsFailed + secondaryStats.feedsFailed,
    articlesStored: primaryStats.articlesStored + secondaryStats.articlesStored,
    articlesFiltered: primaryStats.articlesFiltered + secondaryStats.articlesFiltered,
    articlesSkippedDuplicate:
      primaryStats.articlesSkippedDuplicate + secondaryStats.articlesSkippedDuplicate,
  }

  console.log('[Combiner Workflow] Complete', stats)

  return { success: true, stats }
}

// ============================================================================
// STEP FUNCTIONS
// Each has its own 800s timeout via "use step".
// Node.js modules (supabaseAdmin, etc.) must be imported inside the step.
// ============================================================================

async function loadIngestionContext(): Promise<{
  trades: any[]
  saleTemplate: string
  purchaseTemplate: string
  secondarySaleTemplate: string
  secondaryPurchaseTemplate: string
  secondaryTemplatesEnabled: boolean
  minPostsPerTrade: number
  maxAgeDays: number
  approvedDomains: string[]
  excludedKeywords: string[]
}> {
  "use step"

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { getTopTrades, resolveTickerNames } = await import('@/lib/rss-combiner')

  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select(
      'max_trades, sale_url_template, purchase_url_template, secondary_sale_url_template, secondary_purchase_url_template, min_posts_per_trade, secondary_templates_enabled, max_age_days, trade_freshness_days, max_trades_per_member'
    )
    .limit(1)
    .single()

  const maxTrades = settings?.max_trades ?? 21
  const saleTemplate = settings?.sale_url_template || ''
  const purchaseTemplate = settings?.purchase_url_template || ''
  const secondarySaleTemplate = settings?.secondary_sale_url_template || ''
  const secondaryPurchaseTemplate = settings?.secondary_purchase_url_template || ''
  const minPostsPerTrade = settings?.min_posts_per_trade ?? 20
  const secondaryTemplatesEnabled = settings?.secondary_templates_enabled ?? true
  const maxAgeDays = settings?.max_age_days ?? 7
  const tradeFreshnessDays = settings?.trade_freshness_days ?? 7
  const maxTradesPerMember = settings?.max_trades_per_member ?? 5

  // Approved source domains
  const { data: approvedRows } = await supabaseAdmin
    .from('congress_approved_sources')
    .select('source_domain')
    .eq('is_active', true)

  const approvedDomains = (approvedRows || []).map((r: { source_domain: string }) =>
    r.source_domain.toLowerCase().replace(/^www\./, '')
  )

  // Excluded keywords
  const { data: excludedKeywordRows } = await supabaseAdmin
    .from('combined_feed_excluded_keywords')
    .select('keyword')

  const excludedKeywords = (excludedKeywordRows || []).map((r: { keyword: string }) =>
    r.keyword.toLowerCase()
  )

  // Top trades (already deduped, filtered, per-member-capped)
  const topTrades = await getTopTrades(maxTrades, tradeFreshnessDays, maxTradesPerMember)
  const tradesWithNames = await resolveTickerNames(topTrades)

  return {
    trades: tradesWithNames,
    saleTemplate,
    purchaseTemplate,
    secondarySaleTemplate,
    secondaryPurchaseTemplate,
    secondaryTemplatesEnabled,
    minPostsPerTrade,
    maxAgeDays,
    approvedDomains,
    excludedKeywords,
  }
}

async function primaryFetchPass(params: {
  trades: any[]
  saleTemplate: string
  purchaseTemplate: string
  maxAgeDays: number
  approvedDomains: string[]
  excludedKeywords: string[]
}): Promise<IngestionStats> {
  "use step"

  const { fetchFeedsAndUpsert } = await import('@/lib/rss-combiner')
  return fetchFeedsAndUpsert({
    trades: params.trades,
    saleTemplate: params.saleTemplate,
    purchaseTemplate: params.purchaseTemplate,
    maxAgeDays: params.maxAgeDays,
    approvedDomains: new Set(params.approvedDomains),
    excludedKeywords: params.excludedKeywords,
    label: 'Primary',
  })
}

async function secondaryFetchPass(params: {
  trades: any[]
  secondarySaleTemplate: string
  secondaryPurchaseTemplate: string
  minPostsPerTrade: number
  maxAgeDays: number
  approvedDomains: string[]
  excludedKeywords: string[]
}): Promise<IngestionStats> {
  "use step"

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { fetchFeedsAndUpsert } = await import('@/lib/rss-combiner')

  // Count existing articles per ticker with a single query, then tally in memory.
  // Much faster than N sequential count queries when there are 70+ tickers.
  const tradeTickers = Array.from(new Set(params.trades.map((t) => t.ticker)))
  const articlesPerTrade = new Map<string, number>()
  for (const ticker of tradeTickers) articlesPerTrade.set(ticker, 0)

  const { data: existingRows } = await supabaseAdmin
    .from('congress_feed_articles')
    .select('ticker')
    .in('ticker', tradeTickers)

  for (const row of existingRows || []) {
    const ticker = row.ticker
    if (ticker) {
      articlesPerTrade.set(ticker, (articlesPerTrade.get(ticker) ?? 0) + 1)
    }
  }

  const tradesToRetry = params.trades.filter((t) => {
    const count = articlesPerTrade.get(t.ticker) ?? 0
    return count < params.minPostsPerTrade
  })

  if (tradesToRetry.length === 0) {
    console.log(
      `[Combiner Workflow] All trades meet threshold (min=${params.minPostsPerTrade}), skipping secondary`
    )
    return {
      feedsFetched: 0,
      feedsFailed: 0,
      articlesStored: 0,
      articlesFiltered: 0,
      articlesSkippedDuplicate: 0,
    }
  }

  console.log(
    `[Combiner Workflow] Secondary fetch: ${tradesToRetry.length} trades below threshold`
  )

  return fetchFeedsAndUpsert({
    trades: tradesToRetry,
    saleTemplate: params.secondarySaleTemplate,
    purchaseTemplate: params.secondaryPurchaseTemplate,
    maxAgeDays: params.maxAgeDays,
    approvedDomains: new Set(params.approvedDomains),
    excludedKeywords: params.excludedKeywords,
    label: 'Secondary',
  })
}

async function feedWindowImageGeneration(): Promise<void> {
  "use step"

  const { generateMissingFeedTradeImages } = await import('@/lib/rss-combiner')

  try {
    const generated = await generateMissingFeedTradeImages()
    console.log(`[Combiner Workflow] Feed image generation complete: ${generated} generated`)
  } catch (error) {
    console.error('[Combiner Workflow] Feed image gen failed (non-fatal):', error)
  }
}

async function finalizeIngestion(): Promise<void> {
  "use step"

  const { supabaseAdmin } = await import('@/lib/supabase')
  await supabaseAdmin
    .from('combined_feed_settings')
    .update({ last_ingestion_at: new Date().toISOString() })
    .not('id', 'is', null)
}
