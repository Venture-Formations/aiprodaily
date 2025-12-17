import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { ArticleExtractor } from '../src/lib/article-extractor'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars. Found:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const extractor = new ArticleExtractor()

const BATCH_SIZE = 10
const DELAY_BETWEEN_BATCHES_MS = 60000 // 1 minute

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function reextractPosts() {
  console.log('Fetching posts that need re-extraction...')

  // Fetch posts with failed/null extraction status
  const { data: posts, error } = await supabase
    .from('rss_posts')
    .select('id, source_url, title, extraction_status')
    .or('extraction_status.is.null,extraction_status.in.(blocked,login_required,paywall)')
    .not('source_url', 'is', null)
    .order('publication_date', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return
  }

  console.log(`Found ${posts.length} posts to re-extract`)

  let successCount = 0
  let failCount = 0
  let batchNum = 0

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batchNum++
    const batch = posts.slice(i, i + BATCH_SIZE)
    console.log(`\n--- Batch ${batchNum}/${Math.ceil(posts.length / BATCH_SIZE)} (${batch.length} posts) ---`)

    for (const post of batch) {
      console.log(`\nProcessing: ${post.title?.substring(0, 50)}...`)
      console.log(`URL: ${post.source_url?.substring(0, 60)}...`)
      console.log(`Previous status: ${post.extraction_status || 'NULL'}`)

      try {
        const result = await extractor.extractArticle(post.source_url)

        if (result.success && result.fullText) {
          // Update with extracted content
          const { error: updateError } = await supabase
            .from('rss_posts')
            .update({
              full_article_text: result.fullText,
              extraction_status: 'success',
              extraction_error: null
            })
            .eq('id', post.id)

          if (updateError) {
            console.log(`  ❌ DB update failed: ${updateError.message}`)
            failCount++
          } else {
            console.log(`  ✅ Success! Extracted ${result.fullText.length} chars`)
            successCount++
          }
        } else {
          // Update with new failure status
          const { error: updateError } = await supabase
            .from('rss_posts')
            .update({
              extraction_status: result.status,
              extraction_error: result.error?.substring(0, 500)
            })
            .eq('id', post.id)

          console.log(`  ⚠️ Still failed: ${result.status} - ${result.error?.substring(0, 80)}`)
          failCount++
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`)
        failCount++
      }
    }

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < posts.length) {
      console.log(`\nWaiting 60 seconds before next batch (Jina rate limit)...`)
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  console.log('\n=== COMPLETE ===')
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total: ${posts.length}`)
}

reextractPosts().catch(console.error)
