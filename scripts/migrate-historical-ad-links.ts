/**
 * Migration script: Migrate historical issue_advertisements to issue_module_ads
 *
 * This copies legacy ad-issue links to the new table so previews work for historical issues.
 *
 * Run with: npx tsx scripts/migrate-historical-ad-links.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrate() {
  console.log('Migrating historical ad links to issue_module_ads...\n')

  try {
    // Step 1: Get the "Presented By" module
    const { data: modules, error: moduleError } = await supabase
      .from('ad_modules')
      .select('id, publication_id, name')
      .eq('name', 'Presented By')

    if (moduleError || !modules || modules.length === 0) {
      console.error('No "Presented By" module found. Run migrate-advertorial-to-module.ts first.')
      process.exit(1)
    }

    console.log(`Found ${modules.length} "Presented By" module(s)`)

    // Create a map of publication_id -> module_id
    const moduleMap = new Map<string, string>()
    for (const m of modules) {
      moduleMap.set(m.publication_id, m.id)
      console.log(`  Publication ${m.publication_id} -> Module ${m.id}`)
    }

    // Step 2: Get all legacy links with issue publication info
    const { data: legacyLinks, error: legacyError } = await supabase
      .from('issue_advertisements')
      .select(`
        id,
        issue_id,
        advertisement_id,
        issue_date,
        used_at,
        created_at,
        issue:publication_issues(publication_id, date)
      `)
      .order('created_at', { ascending: true })

    if (legacyError) {
      console.error('Error fetching legacy links:', legacyError.message)
      process.exit(1)
    }

    if (!legacyLinks || legacyLinks.length === 0) {
      console.log('No legacy links to migrate.')
      return
    }

    console.log(`\nFound ${legacyLinks.length} legacy links to migrate`)

    // Step 3: Check existing entries in issue_module_ads to avoid duplicates
    const { data: existingLinks } = await supabase
      .from('issue_module_ads')
      .select('issue_id, ad_module_id')

    const existingSet = new Set(
      (existingLinks || []).map(l => `${l.issue_id}:${l.ad_module_id}`)
    )

    console.log(`Existing issue_module_ads entries: ${existingSet.size}`)

    // Step 4: Migrate each link
    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const link of legacyLinks) {
      const issue = link.issue as any
      if (!issue?.publication_id) {
        console.log(`  Skipping link ${link.id} - no publication_id`)
        skippedCount++
        continue
      }

      const moduleId = moduleMap.get(issue.publication_id)
      if (!moduleId) {
        console.log(`  Skipping link ${link.id} - no module for publication ${issue.publication_id}`)
        skippedCount++
        continue
      }

      // Check if already exists
      const key = `${link.issue_id}:${moduleId}`
      if (existingSet.has(key)) {
        skippedCount++
        continue
      }

      // Insert new entry
      const { error: insertError } = await supabase
        .from('issue_module_ads')
        .insert({
          issue_id: link.issue_id,
          ad_module_id: moduleId,
          advertisement_id: link.advertisement_id,
          selection_mode: 'sequential', // Historical ads used sequential rotation
          selected_at: link.created_at || new Date().toISOString(),
          used_at: link.used_at
        })

      if (insertError) {
        console.error(`  Error migrating link for issue ${link.issue_id}:`, insertError.message)
        errorCount++
      } else {
        migratedCount++
        console.log(`  Migrated: Issue ${issue.date} -> Module ${moduleId} -> Ad ${link.advertisement_id}`)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total legacy links: ${legacyLinks.length}`)
    console.log(`Migrated: ${migratedCount}`)
    console.log(`Skipped (already exist or no module): ${skippedCount}`)
    console.log(`Errors: ${errorCount}`)
    console.log('='.repeat(60))

    // Verify final counts
    const { count: newCount } = await supabase
      .from('issue_module_ads')
      .select('*', { count: 'exact', head: true })

    console.log(`\nFinal issue_module_ads count: ${newCount}`)

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
