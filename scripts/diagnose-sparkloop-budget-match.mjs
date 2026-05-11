#!/usr/bin/env node
/**
 * Diagnose SparkLoop budget-match failures.
 *
 * Calls `/v2/upscribes/{upscribeId}/recommendations` (per-publication) and
 * `/v2/partner_profile/partner_campaigns` (account-level) for one or more
 * publications and reports, per rec, which match strategy (if any) would
 * succeed. Pure read; writes nothing.
 *
 * Usage:
 *   node scripts/diagnose-sparkloop-budget-match.mjs
 *   node scripts/diagnose-sparkloop-budget-match.mjs --publication-id=8277682a-7292-4c36-bca1-a39ca420b305
 *   node scripts/diagnose-sparkloop-budget-match.mjs --slug=trader-leak --sample-keys
 *   node scripts/diagnose-sparkloop-budget-match.mjs --dump-unmatched
 *
 * Default publications: Trader Leak (broken) and AI Accounting Daily (working).
 *
 * Environment (.env.local):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SPARKLOOP_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

const DEFAULT_PUBLICATION_IDS = [
  '8277682a-7292-4c36-bca1-a39ca420b305', // Trader Leak (broken)
  'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', // AI Accounting Daily (working)
]

function parseArgs() {
  const args = {
    publicationIds: [],
    slugs: [],
    sampleKeys: false,
    dumpUnmatched: false,
    dumpAll: false,
  }
  for (const arg of process.argv.slice(2)) {
    if (arg === '--sample-keys') args.sampleKeys = true
    else if (arg === '--dump-unmatched') args.dumpUnmatched = true
    else if (arg === '--dump-all') args.dumpAll = true
    else if (arg.startsWith('--publication-id=')) args.publicationIds.push(arg.slice('--publication-id='.length))
    else if (arg.startsWith('--slug=')) args.slugs.push(arg.slice('--slug='.length))
  }
  return args
}

function normalizeName(s) {
  return (s || '').trim().toLowerCase()
}

async function fetchAllRecommendations(apiKey, upscribeId) {
  const all = []
  let page = 1
  while (true) {
    const url = `${SPARKLOOP_API_BASE}/upscribes/${upscribeId}/recommendations?per_page=200&page=${page}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`recommendations ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    all.push(...(data.recommendations || []))
    if (!data.meta || page >= data.meta.total_pages) break
    page++
  }
  return all
}

async function fetchAllPartnerCampaigns(apiKey) {
  // Try paginated. Current production code only fetches per_page=200 page 1 — we paginate
  // here to detect whether truncation is part of the bug.
  const all = []
  let page = 1
  while (true) {
    const url = `${SPARKLOOP_API_BASE}/partner_profile/partner_campaigns?per_page=200&page=${page}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`partner_campaigns ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    const campaigns = data.partner_campaigns || []
    all.push(...campaigns)
    if (!data.meta || !data.meta.total_pages || page >= data.meta.total_pages) break
    page++
    if (page > 50) break // safety
  }
  return all
}

function buildLookups(campaigns) {
  const byUuid = new Map()
  const byName = new Map()
  const byPartnerProgramUuid = new Map()
  const byAnyUuidField = new Map()
  const allCampaignFields = new Set()

  for (const c of campaigns) {
    for (const k of Object.keys(c)) allCampaignFields.add(k)
    if (c.uuid) byUuid.set(c.uuid, c)
    const nm = normalizeName(c.name || c.publication_name || c.title)
    if (nm) {
      // Keep first occurrence
      if (!byName.has(nm)) byName.set(nm, c)
    }
    if (c.partner_program_uuid) byPartnerProgramUuid.set(c.partner_program_uuid, c)

    // Collect any *_uuid fields for diagnosis
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === 'string' && (k.endsWith('_uuid') || k === 'uuid') && v) {
        if (!byAnyUuidField.has(v)) byAnyUuidField.set(v, { campaign: c, field: k })
      }
    }
  }
  return { byUuid, byName, byPartnerProgramUuid, byAnyUuidField, allCampaignFields }
}

function classifyRec(rec, lookups) {
  const checks = []
  if (lookups.byUuid.has(rec.uuid)) checks.push('byUuid:rec.uuid')
  if (lookups.byUuid.has(rec.partner_program_uuid)) checks.push('byUuid:rec.partner_program_uuid')
  if (lookups.byPartnerProgramUuid.has(rec.partner_program_uuid)) checks.push('byPartnerProgramUuid:rec.partner_program_uuid')
  if (lookups.byPartnerProgramUuid.has(rec.uuid)) checks.push('byPartnerProgramUuid:rec.uuid')
  const nm = normalizeName(rec.publication_name)
  if (nm && lookups.byName.has(nm)) checks.push(`byName:${nm}`)
  if (lookups.byAnyUuidField.has(rec.uuid)) {
    const hit = lookups.byAnyUuidField.get(rec.uuid)
    if (hit.field !== 'uuid') checks.push(`byAnyUuidField[${hit.field}]:rec.uuid`)
  }
  if (lookups.byAnyUuidField.has(rec.partner_program_uuid)) {
    const hit = lookups.byAnyUuidField.get(rec.partner_program_uuid)
    if (hit.field !== 'uuid' && hit.field !== 'partner_program_uuid') checks.push(`byAnyUuidField[${hit.field}]:rec.partner_program_uuid`)
  }
  return checks
}

async function getUpscribeIdForPublication(sb, publicationId) {
  const { data, error } = await sb
    .from('publication_settings')
    .select('key, value')
    .eq('publication_id', publicationId)
    .in('key', ['sparkloop_upscribe_id'])
  if (error) throw error
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return map.sparkloop_upscribe_id || null
}

async function getPublication(sb, slugOrId) {
  const { data, error } = await sb
    .from('publications')
    .select('id, name, slug')
    .or(`id.eq.${slugOrId},slug.eq.${slugOrId}`)
    .single()
  if (error) return null
  return data
}

function pct(num, denom) {
  if (!denom) return '0.0%'
  return `${((num / denom) * 100).toFixed(1)}%`
}

async function runForPublication(sb, apiKey, publication, opts) {
  console.log('\n' + '='.repeat(72))
  console.log(`Publication: ${publication.name} (${publication.slug})`)
  console.log(`  id: ${publication.id}`)

  const upscribeId = await getUpscribeIdForPublication(sb, publication.id)
  if (!upscribeId) {
    console.log('  ❌ No sparkloop_upscribe_id configured — skipping')
    return
  }
  console.log(`  upscribe_id: ${upscribeId}`)

  const [recs, campaigns] = await Promise.all([
    fetchAllRecommendations(apiKey, upscribeId),
    fetchAllPartnerCampaigns(apiKey),
  ])

  console.log(`\n  recommendations: ${recs.length} (active=${recs.filter(r => r.status === 'active').length}, paused=${recs.filter(r => r.status === 'paused').length})`)
  console.log(`  partner_campaigns: ${campaigns.length}`)

  if (opts.sampleKeys && campaigns.length > 0) {
    const sample = campaigns[0]
    console.log(`\n  Sample partner_campaign keys: ${Object.keys(sample).join(', ')}`)
    console.log(`  Sample partner_campaign values:`)
    for (const [k, v] of Object.entries(sample)) {
      const vstr = typeof v === 'object' ? JSON.stringify(v) : String(v)
      console.log(`    ${k}: ${vstr.slice(0, 120)}`)
    }
  }

  const lookups = buildLookups(campaigns)

  const strategyCounts = {
    matched: 0,
    unmatched: 0,
    by_byUuid_rec_uuid: 0,
    by_byUuid_partner_program_uuid: 0,
    by_byPartnerProgramUuid: 0,
    by_byName: 0,
    by_byAnyUuidField: 0,
  }

  const unmatched = []
  for (const rec of recs) {
    const checks = classifyRec(rec, lookups)
    if (checks.length === 0) {
      strategyCounts.unmatched++
      unmatched.push(rec)
    } else {
      strategyCounts.matched++
      if (checks.some(c => c.startsWith('byUuid:rec.uuid'))) strategyCounts.by_byUuid_rec_uuid++
      if (checks.some(c => c.startsWith('byUuid:rec.partner_program_uuid'))) strategyCounts.by_byUuid_partner_program_uuid++
      if (checks.some(c => c.startsWith('byPartnerProgramUuid'))) strategyCounts.by_byPartnerProgramUuid++
      if (checks.some(c => c.startsWith('byName'))) strategyCounts.by_byName++
      if (checks.some(c => c.startsWith('byAnyUuidField'))) strategyCounts.by_byAnyUuidField++
    }
    if (opts.dumpAll) {
      console.log(`    rec ${rec.publication_name} | uuid=${rec.uuid} | ppu=${rec.partner_program_uuid} | match=[${checks.join(' | ') || 'NONE'}]`)
    }
  }

  console.log(`\n  Match results:`)
  console.log(`    matched:   ${strategyCounts.matched} (${pct(strategyCounts.matched, recs.length)})`)
  console.log(`    unmatched: ${strategyCounts.unmatched} (${pct(strategyCounts.unmatched, recs.length)})`)
  console.log(`\n  Strategy hits (a rec can hit multiple strategies):`)
  console.log(`    byUuid via rec.uuid:                ${strategyCounts.by_byUuid_rec_uuid}`)
  console.log(`    byUuid via rec.partner_program_uuid:${strategyCounts.by_byUuid_partner_program_uuid}`)
  console.log(`    byPartnerProgramUuid (new strategy):${strategyCounts.by_byPartnerProgramUuid}`)
  console.log(`    byName (publication_name):          ${strategyCounts.by_byName}`)
  console.log(`    byAnyUuidField (other *_uuid):      ${strategyCounts.by_byAnyUuidField}`)

  if (opts.dumpUnmatched && unmatched.length > 0) {
    console.log(`\n  Unmatched recs (showing up to 10):`)
    for (const r of unmatched.slice(0, 10)) {
      const nm = normalizeName(r.publication_name)
      const sample = campaigns.find(c =>
        normalizeName(c.name).includes(nm.slice(0, 8)) ||
        normalizeName(c.publication_name).includes(nm.slice(0, 8)) ||
        normalizeName(c.title).includes(nm.slice(0, 8))
      )
      console.log(`    - "${r.publication_name}" status=${r.status} uuid=${r.uuid} ppu=${r.partner_program_uuid}`)
      if (sample) {
        console.log(`        possible fuzzy match in campaigns: uuid=${sample.uuid} name="${sample.name}" pub_name="${sample.publication_name}" title="${sample.title}"`)
      }
    }
  }
}

async function main() {
  const args = parseArgs()
  const apiKey = process.env.SPARKLOOP_API_KEY
  if (!apiKey) throw new Error('Missing SPARKLOOP_API_KEY')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const sb = createClient(supabaseUrl, supabaseKey)

  let targets = []
  if (args.slugs.length || args.publicationIds.length) {
    const slugTargets = await Promise.all(args.slugs.map(s => getPublication(sb, s)))
    const idTargets = await Promise.all(args.publicationIds.map(id => getPublication(sb, id)))
    targets = [...slugTargets, ...idTargets].filter(Boolean)
  } else {
    targets = await Promise.all(DEFAULT_PUBLICATION_IDS.map(id => getPublication(sb, id)))
    targets = targets.filter(Boolean)
  }

  if (targets.length === 0) {
    console.log('No publications matched.')
    return
  }

  for (const p of targets) {
    try {
      await runForPublication(sb, apiKey, p, args)
    } catch (err) {
      console.error(`\n[${p.slug}] ERROR:`, err.message)
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
