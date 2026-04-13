/**
 * Backfill script: re-extract + re-score posts that failed with Firecrawl HTTP 402.
 *
 * Targets posts where extraction hit the Firecrawl payment-required error,
 * which strands them without post_ratings (all criteria show N/A in UI).
 * After Firecrawl credits are topped up, run this to recover them:
 *
 *   npx tsx scripts/reextract-firecrawl-402.ts
 *   npx tsx scripts/reextract-firecrawl-402.ts --since=2026-04-11
 *   npx tsx scripts/reextract-firecrawl-402.ts --dry-run
 *   npx tsx scripts/reextract-firecrawl-402.ts --limit=50
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const sinceArg = args.find(a => a.startsWith('--since='))?.split('=')[1]
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const SINCE_DATE = sinceArg || '2026-04-11'
const LIMIT = limitArg ? parseInt(limitArg, 10) : 500
const BATCH_SIZE = 5
const DELAY_BETWEEN_BATCHES_MS = 3000

type Post = {
  id: string
  source_url: string | null
  title: string | null
  article_module_id: string | null
  feed_id: string
  ticker: string | null
  description: string | null
  content: string | null
  rss_feeds: { publication_id: string | null } | null
}

// Dynamic imports: env vars must be loaded before src/lib/supabase.ts evaluates.
// Populated inside run() before any module usage.
let supabase: any
let extractor: any
let scoring: any

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getNewsletterIdForPost(publicationId: string | null): Promise<string | null> {
  if (!publicationId) return null
  const { data } = await supabase
    .from('publications')
    .select('id')
    .eq('id', publicationId)
    .maybeSingle()
  return data?.id ?? null
}

async function scorePost(post: Post, newsletterId: string): Promise<'scored' | 'skipped' | 'failed'> {
  if (!post.article_module_id) return 'skipped'

  try {
    const evaluation: any = await scoring.evaluatePost(
      post as any,
      newsletterId,
      'primary',
      post.article_module_id
    )

    if (
      typeof evaluation.interest_level !== 'number' ||
      typeof evaluation.local_relevance !== 'number' ||
      typeof evaluation.community_impact !== 'number'
    ) {
      return 'failed'
    }

    const ratingRecord: any = {
      post_id: post.id,
      interest_level: evaluation.interest_level,
      local_relevance: evaluation.local_relevance,
      community_impact: evaluation.community_impact,
      ai_reasoning: evaluation.reasoning,
      total_score:
        evaluation.total_score ||
        ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30) * 100,
    }

    const criteriaScores = evaluation.criteria_scores
    if (Array.isArray(criteriaScores)) {
      for (let k = 0; k < criteriaScores.length && k < 5; k++) {
        const n = criteriaScores[k].criteria_number || k + 1
        ratingRecord[`criteria_${n}_score`] = criteriaScores[k].score
        ratingRecord[`criteria_${n}_reason`] = criteriaScores[k].reason
        ratingRecord[`criteria_${n}_weight`] = criteriaScores[k].weight
      }
    }

    const { error } = await supabase.from('post_ratings').insert([ratingRecord])
    if (error) {
      console.log(`    rating insert failed: ${error.message}`)
      return 'failed'
    }
    return 'scored'
  } catch (err) {
    console.log(`    scoring threw: ${err instanceof Error ? err.message : 'Unknown'}`)
    return 'failed'
  }
}

async function run() {
  // Load supabase-dependent modules AFTER dotenv has run.
  const { createClient } = await import('@supabase/supabase-js')
  const { ArticleExtractor } = await import('../src/lib/article-extractor')
  const { Scoring } = await import('../src/lib/rss-processor/scoring')

  supabase = createClient(supabaseUrl!, supabaseServiceKey!)
  extractor = new ArticleExtractor()
  scoring = new Scoring()

  console.log(`\n=== Firecrawl 402 backfill ===`)
  console.log(`Since: ${SINCE_DATE}`)
  console.log(`Limit: ${LIMIT}`)
  console.log(`Dry run: ${dryRun}`)

  const { data: posts, error } = await supabase
    .from('rss_posts')
    .select(
      'id, source_url, title, article_module_id, feed_id, ticker, description, content, ' +
        'rss_feeds!inner(publication_id)'
    )
    .eq('extraction_status', 'failed')
    .ilike('extraction_error', '%Firecrawl HTTP 402%')
    .gte('processed_at', SINCE_DATE)
    .not('source_url', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    console.error('Failed to fetch posts:', error.message)
    process.exit(1)
  }

  const typed = (posts || []) as unknown as Post[]
  console.log(`\nFound ${typed.length} stranded posts to process`)

  if (dryRun) {
    for (const p of typed.slice(0, 10)) {
      console.log(`  [${p.id}] ${p.title?.substring(0, 70)}`)
    }
    if (typed.length > 10) console.log(`  ... and ${typed.length - 10} more`)
    return
  }

  let extracted = 0
  let extractFailed = 0
  let scored = 0
  let scoreFailed = 0
  let scoreSkipped = 0

  for (let i = 0; i < typed.length; i += BATCH_SIZE) {
    const batch = typed.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(typed.length / BATCH_SIZE)
    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} posts) ---`)

    for (const post of batch) {
      if (!post.source_url) continue
      console.log(`\n[${post.id.substring(0, 8)}] ${post.title?.substring(0, 60)}`)

      const result = await extractor.extractArticle(post.source_url)

      if (result.success && result.fullText) {
        const { error: updateError } = await supabase
          .from('rss_posts')
          .update({
            full_article_text: result.fullText,
            extraction_status: 'success',
            extraction_error: null,
          })
          .eq('id', post.id)

        if (updateError) {
          console.log(`  DB update failed: ${updateError.message}`)
          extractFailed++
          continue
        }

        extracted++
        console.log(`  extracted ${result.fullText.length} chars`)

        const newsletterId = await getNewsletterIdForPost(post.rss_feeds?.publication_id ?? null)
        if (!newsletterId) {
          scoreSkipped++
          console.log(`  scoring skipped: no publication_id`)
          continue
        }

        const postForScoring: Post = {
          ...post,
          content: result.fullText,
        }
        ;(postForScoring as any).full_article_text = result.fullText

        const scoreResult = await scorePost(postForScoring, newsletterId)
        if (scoreResult === 'scored') {
          scored++
          console.log(`  scored`)
        } else if (scoreResult === 'skipped') {
          scoreSkipped++
          console.log(`  scoring skipped`)
        } else {
          scoreFailed++
        }
      } else {
        await supabase
          .from('rss_posts')
          .update({
            extraction_status: result.status,
            extraction_error: result.error?.substring(0, 500) ?? null,
          })
          .eq('id', post.id)

        extractFailed++
        console.log(`  still failed: ${result.status} - ${result.error?.substring(0, 80)}`)
      }
    }

    if (i + BATCH_SIZE < typed.length) {
      console.log(`\nWaiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`)
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  console.log(`\n=== COMPLETE ===`)
  console.log(`Extracted: ${extracted}`)
  console.log(`Extract failed: ${extractFailed}`)
  console.log(`Scored: ${scored}`)
  console.log(`Score failed: ${scoreFailed}`)
  console.log(`Score skipped: ${scoreSkipped}`)
  console.log(`Total: ${typed.length}`)
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
