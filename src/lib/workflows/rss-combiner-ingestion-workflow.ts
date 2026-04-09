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
 *   2. Generate primary trade card images (parallel batches)
 *   3. Primary RSS fetch + upsert
 *   4. Secondary RSS fetch (for trades below min_posts_per_trade, if enabled)
 *   5. Feed-window image generation (for tickers in feed output missing images)
 *   6. Finalize (update last_ingestion_at, invalidate cache)
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

  // Step 2: Generate primary trade card images
  const primaryImagesGenerated = await generatePrimaryImages(ctx.trades)
  console.log(`[Combiner Workflow] Generated ${primaryImagesGenerated} primary trade images`)

  // Step 3: Primary RSS fetch + upsert
  const primaryStats = await primaryFetchPass({
    trades: ctx.trades,
    saleTemplate: ctx.saleTemplate,
    purchaseTemplate: ctx.purchaseTemplate,
    maxAgeDays: ctx.maxAgeDays,
    approvedDomains: ctx.approvedDomains,
    excludedKeywords: ctx.excludedKeywords,
  })

  // Step 4: Secondary RSS fetch (if enabled + templates configured)
  let secondaryStats: IngestionStats = {
    feedsFetched: 0,
    feedsFailed: 0,
    articlesStored: 0,
    articlesFiltered: 0,
    articlesSkippedDuplicate: 0,
  }
  if (ctx.secondaryTemplatesEnabled && (ctx.secondarySaleTemplate || ctx.secondaryPurchaseTemplate)) {
    secondaryStats = await secondaryFetchPass({
      trades: ctx.trades,
      secondarySaleTemplate: ctx.secondarySaleTemplate,
      secondaryPurchaseTemplate: ctx.secondaryPurchaseTemplate,
      minPostsPerTrade: ctx.minPostsPerTrade,
      maxAgeDays: ctx.maxAgeDays,
      approvedDomains: ctx.approvedDomains,
      excludedKeywords: ctx.excludedKeywords,
    })
  }

  // Step 5: Feed-window image generation
  await feedWindowImageGeneration()

  // Step 6: Finalize
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

async function generatePrimaryImages(trades: any[]): Promise<number> {
  "use step"

  const { generateAndUploadTradeImage } = await import('@/lib/trade-image-generator')

  const BATCH_SIZE = 10
  const tradesNeedingImages = trades.filter((t) => !t.image_url)
  let imagesGenerated = 0

  for (let i = 0; i < tradesNeedingImages.length; i += BATCH_SIZE) {
    const batch = tradesNeedingImages.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((trade) =>
        generateAndUploadTradeImage({
          ...trade,
          company: trade.company_name,
        })
      )
    )
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const trade = batch[j]
      if (result.status === 'fulfilled' && result.value) {
        trade.image_url = result.value
        imagesGenerated++
      } else if (result.status === 'rejected') {
        console.error(`[Combiner Workflow] Image gen failed for ${trade.id}:`, result.reason)
      }
    }
  }

  return imagesGenerated
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

  // Count existing articles per ticker to find trades below threshold
  const tradeTickers = Array.from(new Set(params.trades.map((t) => t.ticker)))
  const articlesPerTrade = new Map<string, number>()

  for (const ticker of tradeTickers) {
    const { count } = await supabaseAdmin
      .from('congress_feed_articles')
      .select('id', { count: 'exact', head: true })
      .eq('ticker', ticker)
    articlesPerTrade.set(ticker, count ?? 0)
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

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { generateAndUploadTradeImage } = await import('@/lib/trade-image-generator')
  const { invalidateCache } = await import('@/lib/rss-combiner')

  try {
    const { data: feedSettings } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('feed_article_age_days')
      .limit(1)
      .single()

    const feedWindowDays = feedSettings?.feed_article_age_days ?? 14
    const feedCutoff = new Date()
    feedCutoff.setDate(feedCutoff.getDate() - feedWindowDays)

    const { data: feedArticles } = await supabaseAdmin
      .from('congress_feed_articles')
      .select('ticker')
      .gte('published_at', feedCutoff.toISOString())

    const feedTickers = Array.from(
      new Set((feedArticles || []).map((a) => a.ticker).filter(Boolean))
    )
    if (feedTickers.length === 0) return

    const { data: tradesWithImages } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker')
      .in('ticker', feedTickers)
      .not('image_url', 'is', null)

    const tickersWithImages = new Set((tradesWithImages || []).map((t) => t.ticker))
    const tickersMissingImages = feedTickers.filter((t) => !tickersWithImages.has(t))

    if (tickersMissingImages.length === 0) return

    console.log(
      `[Combiner Workflow] Generating missing feed images for ${tickersMissingImages.length} tickers`
    )

    const { data: allRows } = await supabaseAdmin
      .from('congress_trades')
      .select('id, ticker, name, chamber, state, transaction, company, trade_size_parsed')
      .in('ticker', tickersMissingImages)
      .order('trade_size_parsed', { ascending: false, nullsFirst: false })

    const largestByTicker = new Map<string, any>()
    for (const row of allRows || []) {
      if (!largestByTicker.has(row.ticker)) {
        largestByTicker.set(row.ticker, row)
      }
    }

    const { data: nameMappings } = await supabaseAdmin
      .from('ticker_company_names')
      .select('ticker, company_name')
      .in(
        'ticker',
        tickersMissingImages.map((t) => t.toUpperCase())
      )

    const nameMap = new Map(
      (nameMappings || []).map((n) => [n.ticker.toUpperCase(), n.company_name])
    )

    const tradesToGenerate = Array.from(largestByTicker.values()).map((row) => ({
      id: row.id,
      name: row.name,
      chamber: row.chamber,
      state: row.state,
      transaction: row.transaction,
      company: nameMap.get(row.ticker.toUpperCase()) || row.company || row.ticker,
      ticker: row.ticker,
    }))

    const BATCH_SIZE = 10
    let feedImagesGenerated = 0
    for (let i = 0; i < tradesToGenerate.length; i += BATCH_SIZE) {
      const batch = tradesToGenerate.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((t) => generateAndUploadTradeImage(t))
      )
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) feedImagesGenerated++
      }
    }

    if (feedImagesGenerated > 0) {
      console.log(`[Combiner Workflow] Generated ${feedImagesGenerated} feed trade images`)
      invalidateCache()
    }
  } catch (error) {
    console.error('[Combiner Workflow] Feed image gen failed:', error)
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
