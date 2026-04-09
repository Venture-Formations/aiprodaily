/**
 * Resolves Congress member bioguide IDs and photo URLs from public data sources.
 * No API key required — uses unitedstates/congress-legislators JSON + public CDN photos.
 *
 * Caching strategy:
 * - Legislators list: 24h in-memory
 * - Per-bioguide photo buffer: in-memory for the life of the process (Vercel: per invocation)
 * - Per-name bioguide resolution: in-memory for the life of the process
 */

interface Legislator {
  id: { bioguide: string }
  name: { first: string; last: string; official_full?: string }
  terms: Array<{ type: string; start: string; end?: string; state: string; party: string }>
}

let legislatorsCache: Legislator[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Per-process caches (Vercel: one per invocation) to avoid redundant work
// when a single ingestion run processes multiple trades for the same member.
const bioguideResolutionCache = new Map<string, string | null>()
const memberPhotoCache = new Map<string, Buffer | null>()

const LEGISLATORS_CURRENT_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json'
const LEGISLATORS_HISTORICAL_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-historical.json'

async function loadLegislators(): Promise<Legislator[]> {
  if (legislatorsCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return legislatorsCache
  }

  try {
    // Load current + historical in parallel so former-member trades still resolve
    const [currentRes, historicalRes] = await Promise.all([
      fetch(LEGISLATORS_CURRENT_URL, { signal: AbortSignal.timeout(10_000) }),
      fetch(LEGISLATORS_HISTORICAL_URL, { signal: AbortSignal.timeout(15_000) }),
    ])

    const current = currentRes.ok ? ((await currentRes.json()) as Legislator[]) : []
    const historical = historicalRes.ok ? ((await historicalRes.json()) as Legislator[]) : []

    legislatorsCache = [...current, ...historical]
    cacheTimestamp = Date.now()
    return legislatorsCache
  } catch (error) {
    console.error('[congress-photos] Failed to fetch legislators:', error)
    return legislatorsCache || []
  }
}

// Titles that belong at the front of a display name (e.g., "Dr. Richard McCormick")
const PREFIX_TITLES: Record<string, string> = {
  dr: 'Dr.',
  mr: 'Mr.',
  mrs: 'Mrs.',
  ms: 'Ms.',
  miss: 'Miss',
  prof: 'Prof.',
  rev: 'Rev.',
  hon: 'Hon.',
}

// Suffixes that belong at the end (e.g., "Angus King Jr.")
const SUFFIX_TITLES: Record<string, string> = {
  jr: 'Jr.',
  sr: 'Sr.',
  ii: 'II',
  iii: 'III',
  iv: 'IV',
  v: 'V',
}

// Combined set used by normalizeName to strip titles for bioguide matching
const TITLES_AND_SUFFIXES = new Set([
  ...Object.keys(PREFIX_TITLES),
  ...Object.keys(SUFFIX_TITLES),
])

/**
 * Format a member name for display.
 * Moves titles like "Dr" to the front as "Dr.", moves suffixes like "Jr" to the end.
 *
 * Examples:
 *   "Richard Dean Dr Mccormick" → "Dr. Richard Dean Mccormick"
 *   "Angus King Jr"             → "Angus King Jr."
 *   "McConnell, A. Mitchell Jr."→ "A. Mitchell McConnell Jr."
 */
export function formatDisplayName(rawName: string): string {
  if (!rawName) return rawName

  // Handle "Last, First" format (flip to "First Last")
  let name = rawName.trim()
  if (name.includes(',')) {
    const [last, ...rest] = name.split(',').map((s) => s.trim())
    name = `${rest.join(' ')} ${last}`.trim()
  }

  // Split into tokens, preserving case of name words
  const tokens = name.split(/\s+/).filter(Boolean)

  const prefixes: string[] = []
  const suffixes: string[] = []
  const nameParts: string[] = []

  for (const token of tokens) {
    const bare = token.toLowerCase().replace(/[^a-z]/g, '')
    if (PREFIX_TITLES[bare]) {
      prefixes.push(PREFIX_TITLES[bare])
    } else if (SUFFIX_TITLES[bare]) {
      suffixes.push(SUFFIX_TITLES[bare])
    } else {
      nameParts.push(token)
    }
  }

  return [...prefixes, ...nameParts, ...suffixes].join(' ').trim()
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !TITLES_AND_SUFFIXES.has(word))
    .join(' ')
    .trim()
}

/**
 * Resolve a Congress member's bioguide ID from their name and chamber.
 * Handles both "Nancy Pelosi" and "Pelosi, Nancy" formats.
 * Strips common titles (Dr, Jr, III, etc.) before matching.
 */
export async function resolveBioguideId(
  name: string,
  chamber: string | null
): Promise<string | null> {
  if (!name) return null

  // Per-run memoization
  const cacheKey = `${name}::${chamber || ''}`
  if (bioguideResolutionCache.has(cacheKey)) {
    return bioguideResolutionCache.get(cacheKey) ?? null
  }

  const legislators = await loadLegislators()
  if (!legislators.length) return null

  const normalized = normalizeName(name)
  const chamberType = chamber?.toLowerCase() === 'senate' ? 'sen' : 'rep'

  // Try exact match first (prefer current members, check by most-recent term)
  for (const leg of legislators) {
    const lastTerm = leg.terms[leg.terms.length - 1]
    if (chamberType && lastTerm?.type !== chamberType) continue

    const officialFull = normalizeName(leg.name.official_full || '')
    const firstLast = normalizeName(`${leg.name.first} ${leg.name.last}`)
    const lastFirst = normalizeName(`${leg.name.last} ${leg.name.first}`)

    if (normalized === officialFull || normalized === firstLast || normalized === lastFirst) {
      bioguideResolutionCache.set(cacheKey, leg.id.bioguide)
      return leg.id.bioguide
    }
  }

  // Try partial match (last name + first name substring)
  const parts = normalized.split(' ')
  for (const leg of legislators) {
    const lastTerm = leg.terms[leg.terms.length - 1]
    if (chamberType && lastTerm?.type !== chamberType) continue

    const lastName = normalizeName(leg.name.last)
    const firstName = normalizeName(leg.name.first)

    if (parts.some((p) => p === lastName) && parts.some((p) => firstName.startsWith(p))) {
      bioguideResolutionCache.set(cacheKey, leg.id.bioguide)
      return leg.id.bioguide
    }
  }

  bioguideResolutionCache.set(cacheKey, null)
  return null
}

/**
 * Fetch member photo as a buffer. Tries multiple public sources in order.
 * Uses GET directly (not HEAD) because bioguide.congress.gov rejects HEAD requests.
 * Caches results per-process (including null) so repeated calls for the same
 * bioguide within one ingestion run don't re-hit the network.
 */
export async function fetchMemberPhoto(bioguideId: string): Promise<Buffer | null> {
  // Per-run memoization (also caches null for known-missing photos)
  if (memberPhotoCache.has(bioguideId)) {
    return memberPhotoCache.get(bioguideId) ?? null
  }

  const upper = bioguideId.toUpperCase()
  const lower = bioguideId.toLowerCase()
  const urls = [
    `https://bioguide.congress.gov/bioguide/photo/${upper[0]}/${upper}.jpg`,
    `https://www.congress.gov/img/member/${lower}_200.jpg`,
    `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/225x275/${upper}.jpg`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIProDaily/1.0)',
          'Accept': 'image/jpeg,image/*,*/*;q=0.8',
        },
      })
      if (!res.ok) continue
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) continue
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      if (buffer.length < 1000) continue // Too small to be a real photo
      memberPhotoCache.set(bioguideId, buffer)
      return buffer
    } catch {
      // Try next URL
    }
  }

  memberPhotoCache.set(bioguideId, null)
  return null
}

/**
 * DEPRECATED — use fetchMemberPhoto() directly.
 * Kept for backward compatibility. Now just fetches the buffer and returns
 * a data URL so existing callers work.
 */
export async function getMemberPhotoUrl(bioguideId: string): Promise<string | null> {
  const buffer = await fetchMemberPhoto(bioguideId)
  if (!buffer) return null
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}
