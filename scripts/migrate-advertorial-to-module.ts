/**
 * Migration script: Migrate Legacy Advertorial to "Presented By" Ad Module
 *
 * This script:
 * 1. Creates "Presented By" ad module for publications with legacy ads
 * 2. Creates advertisers from unique company names
 * 3. Links legacy ads to the "Presented By" module
 * 4. Links ads to their advertisers
 *
 * Run with: npx tsx scripts/migrate-advertorial-to-module.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('   SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'OK' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrate() {
  console.log('Starting advertorial to ad module migration...\n')

  try {
    // Step 1: Get publications with legacy ads (no ad_module_id)
    console.log('Step 1: Finding publications with legacy ads...')
    const { data: legacyAds, error: legacyError } = await supabase
      .from('advertisements')
      .select('publication_id, company_name')
      .is('ad_module_id', null)
      .not('publication_id', 'is', null)

    if (legacyError) {
      console.error('Error fetching legacy ads:', legacyError)
      process.exit(1)
    }

    if (!legacyAds || legacyAds.length === 0) {
      console.log('No legacy ads found. Migration may already be complete.')

      // Check existing state
      const { data: modules } = await supabase
        .from('ad_modules')
        .select('id, publication_id, name')
        .eq('name', 'Presented By')

      console.log(`\nExisting "Presented By" modules: ${modules?.length || 0}`)
      modules?.forEach(m => console.log(`  - ${m.id} (pub: ${m.publication_id})`))

      const { data: linkedAds } = await supabase
        .from('advertisements')
        .select('id, ad_module_id')
        .not('ad_module_id', 'is', null)

      console.log(`Ads linked to modules: ${linkedAds?.length || 0}`)
      return
    }

    // Get unique publication IDs
    const publicationIds = Array.from(new Set(legacyAds.map(a => a.publication_id)))
    console.log(`Found ${legacyAds.length} legacy ads across ${publicationIds.length} publications`)

    // Step 2: Create "Presented By" modules
    console.log('\nStep 2: Creating "Presented By" ad modules...')

    for (const pubId of publicationIds) {
      // Check if module already exists
      const { data: existing } = await supabase
        .from('ad_modules')
        .select('id')
        .eq('publication_id', pubId)
        .eq('name', 'Presented By')
        .single()

      if (existing) {
        console.log(`  Publication ${pubId}: Module already exists (${existing.id})`)
        continue
      }

      // Create the module
      const { data: newModule, error: createError } = await supabase
        .from('ad_modules')
        .insert({
          publication_id: pubId,
          name: 'Presented By',
          display_order: 0,
          is_active: true,
          selection_mode: 'sequential',
          block_order: ['title', 'image', 'body', 'button'],
          config: {}
        })
        .select('id')
        .single()

      if (createError) {
        console.error(`  Publication ${pubId}: Error creating module:`, createError.message)
      } else {
        console.log(`  Publication ${pubId}: Created module (${newModule?.id})`)
      }
    }

    // Step 3: Create advertisers from company names
    console.log('\nStep 3: Creating advertisers from company names...')

    const companyNames = Array.from(new Set(legacyAds.filter(a => a.company_name).map(a => JSON.stringify({ pub: a.publication_id, name: a.company_name }))))
      .map(s => JSON.parse(s))

    for (const { pub, name } of companyNames) {
      // Check if advertiser already exists
      const { data: existing } = await supabase
        .from('advertisers')
        .select('id')
        .eq('publication_id', pub)
        .eq('company_name', name)
        .single()

      if (existing) {
        continue // Skip existing advertisers
      }

      // Create advertiser
      const { error: createError } = await supabase
        .from('advertisers')
        .insert({
          publication_id: pub,
          company_name: name,
          is_active: true
        })

      if (createError) {
        console.error(`  Advertiser "${name}": Error creating:`, createError.message)
      } else {
        console.log(`  Created advertiser: "${name}"`)
      }
    }

    // Step 4: Link ads to modules
    console.log('\nStep 4: Linking ads to "Presented By" modules...')

    for (const pubId of publicationIds) {
      // Get module ID
      const { data: module } = await supabase
        .from('ad_modules')
        .select('id')
        .eq('publication_id', pubId)
        .eq('name', 'Presented By')
        .single()

      if (!module) {
        console.error(`  Publication ${pubId}: No module found, skipping`)
        continue
      }

      // Update ads
      const { data: updated, error: updateError } = await supabase
        .from('advertisements')
        .update({ ad_module_id: module.id })
        .eq('publication_id', pubId)
        .is('ad_module_id', null)
        .select('id')

      if (updateError) {
        console.error(`  Publication ${pubId}: Error linking ads:`, updateError.message)
      } else {
        console.log(`  Publication ${pubId}: Linked ${updated?.length || 0} ads to module ${module.id}`)
      }
    }

    // Step 5: Link ads to advertisers
    console.log('\nStep 5: Linking ads to advertisers...')

    // Get all unlinked ads with company names
    const { data: unlinkedAds } = await supabase
      .from('advertisements')
      .select('id, publication_id, company_name')
      .is('advertiser_id', null)
      .not('company_name', 'is', null)
      .not('publication_id', 'is', null)

    if (unlinkedAds && unlinkedAds.length > 0) {
      for (const ad of unlinkedAds) {
        // Find the advertiser
        const { data: advertiser } = await supabase
          .from('advertisers')
          .select('id')
          .eq('publication_id', ad.publication_id)
          .eq('company_name', ad.company_name)
          .single()

        if (advertiser) {
          await supabase
            .from('advertisements')
            .update({ advertiser_id: advertiser.id })
            .eq('id', ad.id)
        }
      }
      console.log(`  Linked ${unlinkedAds.length} ads to advertisers`)
    } else {
      console.log('  No ads need advertiser linking')
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('Migration Summary')
    console.log('='.repeat(60))

    const { data: finalModules } = await supabase
      .from('ad_modules')
      .select('id')
      .eq('name', 'Presented By')

    const { data: linkedAds } = await supabase
      .from('advertisements')
      .select('id')
      .not('ad_module_id', 'is', null)

    const { data: unlinkedFinal } = await supabase
      .from('advertisements')
      .select('id')
      .is('ad_module_id', null)

    console.log(`"Presented By" modules created: ${finalModules?.length || 0}`)
    console.log(`Ads linked to modules: ${linkedAds?.length || 0}`)
    console.log(`Ads still unlinked: ${unlinkedFinal?.length || 0}`)
    console.log('='.repeat(60) + '\n')

    console.log('Migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
migrate()
