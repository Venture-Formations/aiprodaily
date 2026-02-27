/**
 * Provision a new publication with all required database rows.
 *
 * Interactive:  npx tsx scripts/provision-publication.ts
 * Non-interactive:
 *   npx tsx scripts/provision-publication.ts \
 *     --name "Test Pub" --slug test-pub --subdomain test-pub \
 *     --domain testpub.com --email test@example.com \
 *     --sender "Test Pub" --from test@example.com --color "#1C293D"
 *
 * Creates:
 *   1. publications row
 *   2. ~53 publication_settings key-value pairs
 *   3. article_modules + article_module_criteria + article_module_prompts
 *   4. prompt_modules, ai_app_modules, text_box_modules + blocks, feedback_modules
 *
 * All schedules are disabled by default. MailerLite group IDs are left blank.
 * AI prompts are NOT inserted — they fall back to global app_settings defaults.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'
import { provisionPublication, type ProvisionInput } from '../src/lib/provisioner'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('  SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'OK' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---------------------------------------------------------------------------
// CLI arg parser (for non-interactive mode)
// ---------------------------------------------------------------------------

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

let rl: readline.Interface | null = null

function ask(question: string, defaultValue?: string): Promise<string> {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  }
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  return new Promise((resolve) => {
    rl!.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function provision() {
  const cliArgs = parseArgs()
  const isNonInteractive = !!cliArgs.name

  console.log('='.repeat(60))
  console.log('  Publication Provisioning Script')
  console.log('='.repeat(60))
  console.log()

  // Gather required inputs (from CLI args or interactive prompts)
  let name: string, slug: string, subdomain: string, websiteDomain: string
  let contactEmail: string, senderName: string, fromEmail: string, primaryColor: string

  if (isNonInteractive) {
    name = cliArgs.name
    slug = cliArgs.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    subdomain = cliArgs.subdomain || slug
    websiteDomain = cliArgs.domain || ''
    contactEmail = cliArgs.email || ''
    senderName = cliArgs.sender || name
    fromEmail = cliArgs.from || contactEmail
    primaryColor = cliArgs.color || '#1C293D'
  } else {
    name = await ask('Publication name (e.g. "AI Pros Daily")')
    if (!name) { console.error('Name is required.'); process.exit(1) }

    slug = await ask('Slug (lowercase, hyphens)', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    subdomain = await ask('Subdomain', slug)
    websiteDomain = await ask('Website domain (e.g. aiprodaily.com)', '')
    contactEmail = await ask('Contact email')
    senderName = await ask('Sender name (for emails)', name)
    fromEmail = await ask('From email', contactEmail)
    primaryColor = await ask('Primary color', '#1C293D')
  }

  console.log()
  console.log('Will create publication:')
  console.log(`  Name:      ${name}`)
  console.log(`  Slug:      ${slug}`)
  console.log(`  Subdomain: ${subdomain}`)
  console.log(`  Domain:    ${websiteDomain || '(none)'}`)
  console.log(`  Email:     ${contactEmail}`)
  console.log(`  Color:     ${primaryColor}`)
  console.log()

  if (!isNonInteractive) {
    const confirm = await ask('Proceed? (y/N)', 'N')
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted.')
      process.exit(0)
    }
  }

  console.log()

  const input: ProvisionInput = {
    name,
    slug,
    subdomain,
    contactEmail,
    senderName,
    fromEmail,
    primaryColor,
    websiteDomain: websiteDomain || '',
  }

  const result = await provisionPublication(input, supabase)

  console.log()
  console.log('='.repeat(60))
  console.log('  Provisioning Complete')
  console.log('='.repeat(60))
  console.log()
  console.log(`  Publication ID:      ${result.publicationId}`)
  console.log(`  Publication slug:    ${result.slug}`)
  console.log(`  Settings inserted:   ${result.settingsCount}`)
  console.log(`  Article module:      ${result.modules.articleModuleId || 'FAILED'}`)
  console.log(`  Prompt module:       ${result.modules.promptModuleId || 'FAILED'}`)
  console.log(`  AI App module:       ${result.modules.aiAppModuleId || 'FAILED'}`)
  console.log(`  Text Box module:     ${result.modules.textBoxModuleId || 'FAILED'}`)
  console.log(`  Feedback module:     ${result.modules.feedbackModuleId || 'FAILED'}`)
  console.log()
  console.log('  Manual steps remaining:')
  console.log('  1. Create MailerLite groups and set group IDs in publication_settings')
  console.log('  2. Add RSS feeds to rss_feeds table')
  console.log('  3. Upload logo and header images, update logo_url/header_image_url')
  console.log('  4. Add prompt ideas to prompt_ideas table (for Prompt of the Day)')
  console.log('  5. Add AI applications to ai_applications table')
  console.log('  6. Enable schedules when ready (email_reviewScheduleEnabled, email_dailyScheduleEnabled)')
  console.log('  7. Customize article module criteria AI prompts for your audience')
  console.log()
  console.log('  See: docs/recipes/provision-publication.md for full checklist')
  console.log('='.repeat(60))

  if (rl) rl.close()
}

// Run
provision().catch((err) => {
  console.error('Provisioning failed:', err)
  process.exit(1)
})
