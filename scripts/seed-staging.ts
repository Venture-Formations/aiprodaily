/**
 * seed-staging.ts — Seeds the staging Supabase project with the production
 * publication record and essential settings.
 *
 * Usage:
 *   STAGING_SUPABASE_URL=https://xxx.supabase.co \
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/seed-staging.ts
 *
 * The staging DB is a separate Supabase project with the same schema.
 * This script inserts the real publication (same ID) so all code paths
 * work identically — the only difference is which MailerLite group IDs
 * are stored in publication_settings.
 *
 * IDEMPOTENT — running it again will upsert, not duplicate.
 */

import { createClient } from '@supabase/supabase-js'

const STAGING_URL = process.env.STAGING_SUPABASE_URL
const STAGING_KEY = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY

if (!STAGING_URL || !STAGING_KEY) {
  console.error('❌ Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

// Same publication ID as production. The staging DB is a completely separate
// Supabase project, so there's no collision — and using the same ID means
// every code path that references publication_id works without changes.
const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

async function seed() {
  console.log('Seeding staging database...')

  // 1. Publication — same as production
  const { error: pubError } = await supabase
    .from('publications')
    .upsert({
      id: PUBLICATION_ID,
      name: 'AI Pros Daily',
      slug: 'aiprodaily',
      is_active: true,
    }, { onConflict: 'id' })

  if (pubError) {
    console.error('❌ Failed to upsert publication:', pubError.message)
  } else {
    console.log('  ✅ Publication upserted')
  }

  // 2. Publication settings — production values except MailerLite group IDs
  //    which should point to a staging test group.
  const settings: Record<string, string> = {
    // Email provider
    email_provider: 'mailerlite',

    // MailerLite group IDs — set these to your test group after creating one
    mailerlite_main_group_id: '',
    mailerlite_review_group_id: '',
    mailerlite_secondary_group_id: '',

    // Schedule (safe defaults — won't auto-send without group IDs)
    email_scheduledSendTime: '21:00',
    email_dailyScheduledSendTime: '09:00',
    timezone_id: '12', // America/Chicago
  }

  for (const [key, value] of Object.entries(settings)) {
    const { error } = await supabase
      .from('publication_settings')
      .upsert({
        publication_id: PUBLICATION_ID,
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'publication_id,key' })

    if (error) {
      console.error(`  ❌ Setting "${key}":`, error.message)
    }
  }
  console.log(`  ✅ ${Object.keys(settings).length} publication settings upserted`)

  console.log('\n✅ Staging seed complete.')
  console.log('\nNext steps:')
  console.log('  1. Create a test group in MailerLite (e.g., "Staging Test")')
  console.log('  2. Set mailerlite_main_group_id and mailerlite_review_group_id')
  console.log('     in the staging DB to that test group ID')
  console.log('  3. Copy remaining production settings you need (branding, sender, etc.)')
  console.log('  4. Configure Vercel Preview env vars to point to this Supabase project')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
