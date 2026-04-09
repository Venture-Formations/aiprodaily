#!/usr/bin/env node

/**
 * One-shot cleanup: delete all cached trade card images from Supabase Storage
 * so the next rss-combiner ingestion regenerates them with the new auto-sizing.
 *
 * Usage (loads from .env.local by default for production):
 *   node --env-file=.env.local scripts/delete-trade-images.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log(`Target: ${supabaseUrl}`)

const supabase = createClient(supabaseUrl, serviceKey)
const BUCKET = 'img'
const PREFIX = 'st/t'

async function main() {
  console.log(`Listing files in ${BUCKET}/${PREFIX}/ ...`)

  // List all files in the prefix (may need pagination for >1000 files)
  const allFiles = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(PREFIX, { limit: pageSize, offset })

    if (error) {
      console.error('❌ List failed:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) break
    allFiles.push(...data)

    if (data.length < pageSize) break
    offset += pageSize
  }

  if (allFiles.length === 0) {
    console.log('✓ No files to delete.')
    return
  }

  console.log(`Found ${allFiles.length} files.`)

  // Delete in batches of 100
  const paths = allFiles.map(f => `${PREFIX}/${f.name}`)
  const BATCH = 100
  let deleted = 0

  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message)
    } else {
      deleted += batch.length
      console.log(`  Deleted batch ${Math.floor(i / BATCH) + 1}: ${batch.length} files`)
    }
  }

  console.log(`\n✓ Deleted ${deleted}/${allFiles.length} files.`)
}

main().catch((err) => {
  console.error('❌ Script failed:', err)
  process.exit(1)
})
