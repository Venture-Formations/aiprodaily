/**
 * One-time migration script to normalize all existing advertorial HTML
 * This applies the email-safe table formatting to all ads in the database
 *
 * Run with: npx tsx scripts/migrate-normalize-ads.ts
 */

import { createClient } from '@supabase/supabase-js'
import { normalizeEmailHtml } from '../src/lib/html-normalizer'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateAdvertisements() {
  console.log('🚀 Starting advertorial HTML normalization migration...\n')

  try {
    // Fetch all advertisements
    const { data: ads, error: fetchError } = await supabase
      .from('advertisements')
      .select('id, title, body, status')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching advertisements:', fetchError)
      process.exit(1)
    }

    if (!ads || ads.length === 0) {
      console.log('ℹ️  No advertisements found in database')
      return
    }

    console.log(`📊 Found ${ads.length} advertisements to process\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const ad of ads) {
      try {
        console.log(`\n▶ Processing ad ${ad.id}: "${ad.title}"`)
        console.log(`  Status: ${ad.status}`)

        // Check if body contains bullet points or lists that need normalization
        const needsNormalization =
          ad.body.includes('<ul>') ||
          ad.body.includes('<ol>') ||
          ad.body.includes('<li>') ||
          ad.body.includes('•') ||
          (ad.body.includes('<br') && ad.body.includes('</p>'))

        if (!needsNormalization) {
          console.log('  ⏭️  Skipping - no lists or bullets detected')
          skipCount++
          continue
        }

        // Show original HTML snippet
        const originalSnippet = ad.body.substring(0, 150).replace(/\n/g, ' ')
        console.log(`  Original: ${originalSnippet}...`)

        // Apply normalization
        const normalizedBody = normalizeEmailHtml(ad.body)

        // Check if anything actually changed
        if (normalizedBody === ad.body) {
          console.log('  ⏭️  Skipping - HTML unchanged after normalization')
          skipCount++
          continue
        }

        // Show normalized HTML snippet
        const normalizedSnippet = normalizedBody.substring(0, 150).replace(/\n/g, ' ')
        console.log(`  Normalized: ${normalizedSnippet}...`)

        // Update the database
        const { error: updateError } = await supabase
          .from('advertisements')
          .update({
            body: normalizedBody,
            updated_at: new Date().toISOString()
          })
          .eq('id', ad.id)

        if (updateError) {
          console.error(`  ❌ Error updating ad ${ad.id}:`, updateError)
          errorCount++
          continue
        }

        console.log('  ✅ Successfully normalized and updated')
        successCount++

      } catch (error) {
        console.error(`  ❌ Error processing ad ${ad.id}:`, error)
        errorCount++
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📋 Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total ads processed:     ${ads.length}`)
    console.log(`✅ Successfully updated: ${successCount}`)
    console.log(`⏭️  Skipped:              ${skipCount}`)
    console.log(`❌ Errors:               ${errorCount}`)
    console.log('='.repeat(60) + '\n')

    if (errorCount > 0) {
      console.log('⚠️  Some ads failed to update. Please review the errors above.')
      process.exit(1)
    } else {
      console.log('🎉 Migration completed successfully!')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
migrateAdvertisements()
