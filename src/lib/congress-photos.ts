/**
 * Resolves Congress member bioguide IDs and photo URLs from public data sources.
 * No API key required — uses unitedstates/congress-legislators JSON + public CDN photos.
 */

interface Legislator {
  id: { bioguide: string }
  name: { first: string; last: string; official_full?: string }
  terms: Array<{ type: string; start: string; end?: string; state: string; party: string }>
}

let legislatorsCache: Legislator[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const LEGISLATORS_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json'

async function loadLegislators(): Promise<Legislator[]> {
  if (legislatorsCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return legislatorsCache
  }

  try {
    const res = await fetch(LEGISLATORS_URL, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    legislatorsCache = (await res.json()) as Legislator[]
    cacheTimestamp = Date.now()
    return legislatorsCache
  } catch (error) {
    console.error('[congress-photos] Failed to fetch legislators:', error)
    return legislatorsCache || []
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve a Congress member's bioguide ID from their name and chamber.
 * Handles both "Nancy Pelosi" and "Pelosi, Nancy" formats.
 */
export async function resolveBioguideId(
  name: string,
  chamber: string | null
): Promise<string | null> {
  if (!name) return null

  const legislators = await loadLegislators()
  if (!legislators.length) return null

  const normalized = normalizeName(name)
  const chamberType = chamber?.toLowerCase() === 'senate' ? 'sen' : 'rep'

  // Try exact match first
  for (const leg of legislators) {
    const lastTerm = leg.terms[leg.terms.length - 1]
    if (chamberType && lastTerm?.type !== chamberType) continue

    const officialFull = normalizeName(leg.name.official_full || '')
    const firstLast = normalizeName(`${leg.name.first} ${leg.name.last}`)
    const lastFirst = normalizeName(`${leg.name.last} ${leg.name.first}`)

    if (normalized === officialFull || normalized === firstLast || normalized === lastFirst) {
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
      return leg.id.bioguide
    }
  }

  return null
}

/**
 * Get a publicly accessible photo URL for a Congress member by bioguide ID.
 * Tries three sources in order, verifying availability with HEAD requests.
 */
export async function getMemberPhotoUrl(bioguideId: string): Promise<string | null> {
  const urls = [
    `https://bioguide.congress.gov/bioguide/photo/${bioguideId[0].toUpperCase()}/${bioguideId.toUpperCase()}.jpg`,
    `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`,
    `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/225x275/${bioguideId.toUpperCase()}.jpg`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) return url
    } catch {
      // Try next URL
    }
  }

  return null
}

/**
 * Fetch member photo as a buffer. Returns null if no photo found.
 */
export async function fetchMemberPhoto(bioguideId: string): Promise<Buffer | null> {
  const url = await getMemberPhotoUrl(bioguideId)
  if (!url) return null

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}
