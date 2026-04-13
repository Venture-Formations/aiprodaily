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
  name: { first: string; last: string; official_full?: string; nickname?: string; middle?: string }
  terms: Array<{ type: string; start: string; end?: string; state: string; party: string }>
}

interface LegislatorSets {
  current: Legislator[]
  historical: Legislator[]
}

let legislatorsCache: LegislatorSets | null = null
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

// Dedupe in-flight legislator loads so parallel callers (runIngestion's
// batch of 5) share a single network fetch instead of racing.
let legislatorsLoadPromise: Promise<LegislatorSets> | null = null

async function loadLegislators(): Promise<LegislatorSets> {
  if (legislatorsCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return legislatorsCache
  }
  if (legislatorsLoadPromise) return legislatorsLoadPromise

  legislatorsLoadPromise = (async (): Promise<LegislatorSets> => {
    // allSettled so a partial failure still returns whichever list loaded.
    // Promise.all would reject the whole call on a single timeout, leaving
    // resolveBioguideId with empty arrays and silently breaking matching.
    const [currentRes, historicalRes] = await Promise.allSettled([
      fetch(LEGISLATORS_CURRENT_URL, { signal: AbortSignal.timeout(15_000) }),
      fetch(LEGISLATORS_HISTORICAL_URL, { signal: AbortSignal.timeout(20_000) }),
    ])

    let current: Legislator[] = []
    let historical: Legislator[] = []

    if (currentRes.status === 'fulfilled' && currentRes.value.ok) {
      try {
        current = (await currentRes.value.json()) as Legislator[]
      } catch (err) {
        console.error('[congress-photos] Failed to parse current legislators:', err)
      }
    } else {
      console.error('[congress-photos] Failed to fetch current legislators:',
        currentRes.status === 'rejected' ? currentRes.reason : `status ${currentRes.value.status}`)
    }

    if (historicalRes.status === 'fulfilled' && historicalRes.value.ok) {
      try {
        historical = (await historicalRes.value.json()) as Legislator[]
      } catch (err) {
        console.error('[congress-photos] Failed to parse historical legislators:', err)
      }
    } else {
      console.error('[congress-photos] Failed to fetch historical legislators:',
        historicalRes.status === 'rejected' ? historicalRes.reason : `status ${historicalRes.value.status}`)
    }

    const sets: LegislatorSets = { current, historical }
    // Only persist to the module-level cache if at least one list loaded.
    // Caching empty arrays would poison every subsequent lookup for 24h.
    if (current.length > 0 || historical.length > 0) {
      legislatorsCache = sets
      cacheTimestamp = Date.now()
    }
    return sets
  })()

  try {
    return await legislatorsLoadPromise
  } finally {
    legislatorsLoadPromise = null
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
 * Common formal ↔ informal first-name pairs used in US politics.
 * Keyed by formal name → list of informals. The reverse map is built at
 * module load for O(1) bidirectional lookup.
 */
const NICKNAME_ALIASES: Record<string, string[]> = {
  abraham: ['abe'],
  albert: ['al', 'bert'],
  alexander: ['alex', 'alec', 'xander', 'sandy'],
  andrew: ['andy', 'drew'],
  anthony: ['tony'],
  benjamin: ['ben', 'benji'],
  bernard: ['bernie'],
  bradley: ['brad'],
  charles: ['charlie', 'chuck'],
  christopher: ['chris'],
  daniel: ['dan', 'danny'],
  david: ['dave', 'davey'],
  donald: ['don', 'donnie'],
  douglas: ['doug'],
  edward: ['ed', 'eddie', 'ted', 'ned'],
  edwin: ['ed'],
  elizabeth: ['liz', 'beth', 'betty', 'betsy', 'eliza'],
  francis: ['frank', 'frankie'],
  franklin: ['frank'],
  frederick: ['fred', 'freddy'],
  gerald: ['gerry', 'jerry'],
  gregory: ['greg'],
  harold: ['hal', 'harry'],
  henry: ['hank', 'harry'],
  herbert: ['herb', 'herbie'],
  james: ['jim', 'jimmy', 'jamie'],
  jeffrey: ['jeff'],
  jennifer: ['jen', 'jenny'],
  john: ['johnny', 'jack'],
  jonathan: ['jon'],
  joseph: ['joe', 'joey'],
  joshua: ['josh'],
  kathleen: ['kathy', 'kate', 'katie'],
  katherine: ['kate', 'katie', 'kathy'],
  kenneth: ['ken', 'kenny'],
  lawrence: ['larry', 'lars'],
  leonard: ['leo', 'lenny'],
  margaret: ['maggie', 'meg', 'peg', 'peggy'],
  matthew: ['matt', 'matty'],
  michael: ['mike', 'mikey'],
  nathaniel: ['nate', 'nat'],
  nicholas: ['nick', 'nicky'],
  patricia: ['pat', 'patty', 'trish'],
  patrick: ['pat', 'paddy'],
  peter: ['pete'],
  philip: ['phil'],
  raymond: ['ray'],
  rebecca: ['becky', 'becca'],
  richard: ['rich', 'rick', 'ricky', 'dick', 'dickie'],
  robert: ['rob', 'bob', 'bobby', 'robby'],
  ronald: ['ron', 'ronnie'],
  samuel: ['sam', 'sammy'],
  stephen: ['steve', 'stevie'],
  steven: ['steve', 'stevie'],
  susan: ['sue', 'susie'],
  theodore: ['ted', 'teddy'],
  thomas: ['tom', 'tommy'],
  timothy: ['tim', 'timmy'],
  virginia: ['ginny', 'ginger'],
  walter: ['walt', 'wally'],
  william: ['bill', 'billy', 'will', 'willy'],
  zachary: ['zach', 'zack'],
}

// Flattened reverse lookup: every known variant (formal + all informals)
// maps to the same Set of siblings, so firstNamesMatch is O(1).
const NICKNAME_LOOKUP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>()
  for (const [formal, informals] of Object.entries(NICKNAME_ALIASES)) {
    const siblings = new Set<string>([formal, ...informals])
    map.set(formal, siblings)
    for (const i of informals) map.set(i, siblings)
  }
  return map
})()

/**
 * Decide whether two first names should be treated as equivalent.
 * Matches on: exact equality, known nickname pair, or a ≥3-char shared prefix
 * in either direction ("rich" ↔ "richard").
 */
function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const siblings = NICKNAME_LOOKUP.get(a)
  if (siblings && siblings.has(b)) return true
  if (a.length >= 3 && b.startsWith(a)) return true
  if (b.length >= 3 && a.startsWith(b)) return true
  return false
}

/**
 * Pick the best legislator from a set of matches. When the trade carries a
 * state, prefer the legislator whose most-recent term is in that state —
 * this disambiguates same-name members (e.g. two "Mike Johnsons").
 */
function pickBestByState(candidates: Legislator[], stateCode: string | null): Legislator | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1 || !stateCode) return candidates[0]
  const wanted = stateCode.toUpperCase()
  return (
    candidates.find((c) => c.terms[c.terms.length - 1]?.state?.toUpperCase() === wanted) ||
    candidates[0]
  )
}

/**
 * Run the full matching cascade against a single pool (current OR historical).
 * Returns null if nothing matches in this pool.
 */
function findMatch(
  pool: Legislator[],
  normalized: string,
  parts: string[],
  chamberType: 'sen' | 'rep' | null,
  state: string | null
): string | null {
  // Phase 1: exact equality with official_full / firstLast / lastFirst
  const exactCandidates: Legislator[] = []
  for (const leg of pool) {
    const lastTerm = leg.terms[leg.terms.length - 1]
    if (chamberType && lastTerm?.type !== chamberType) continue

    const officialFull = normalizeName(leg.name.official_full || '')
    const firstLast = normalizeName(`${leg.name.first} ${leg.name.last}`)
    const lastFirst = normalizeName(`${leg.name.last} ${leg.name.first}`)

    if (normalized === officialFull || normalized === firstLast || normalized === lastFirst) {
      exactCandidates.push(leg)
    }
  }
  if (exactCandidates.length > 0) {
    return pickBestByState(exactCandidates, state)?.id.bioguide ?? null
  }

  // Phase 2: fuzzy — last name substring + nickname-aware first name match
  const fuzzyCandidates: Legislator[] = []
  for (const leg of pool) {
    const lastTerm = leg.terms[leg.terms.length - 1]
    if (chamberType && lastTerm?.type !== chamberType) continue

    const legLast = normalizeName(leg.name.last || '')
    const legFirst = normalizeName(leg.name.first || '')
    const legNick = normalizeName(leg.name.nickname || '')
    if (!legLast) continue

    // Last name must appear as a substring of the normalized input.
    // Substring (not token equality) so multi-word last names like
    // "Van Duyne" / "de la Cruz" still match.
    if (!normalized.includes(legLast)) continue

    const firstHit =
      parts.some((p) => firstNamesMatch(p, legFirst)) ||
      (legNick && parts.some((p) => firstNamesMatch(p, legNick)))

    if (firstHit) {
      fuzzyCandidates.push(leg)
    }
  }
  if (fuzzyCandidates.length > 0) {
    return pickBestByState(fuzzyCandidates, state)?.id.bioguide ?? null
  }

  return null
}

/**
 * Resolve a Congress member's bioguide ID from their name, chamber, and state.
 * Handles "Nancy Pelosi" and "Pelosi, Nancy" formats, nickname ↔ formal name
 * pairs (Rich ↔ Richard), and middle names / initials.
 *
 * Critically: exhausts every matching strategy on the CURRENT legislators list
 * before considering historical. Otherwise a long-dead "Richard McCormick" can
 * beat current "Rich McCormick" and deliver a 19th-century archival photo.
 */
export async function resolveBioguideId(
  name: string,
  chamber: string | null,
  state: string | null = null
): Promise<string | null> {
  if (!name) return null

  const cacheKey = `${name}::${chamber || ''}::${state || ''}`
  // Success cache hit — return immediately
  const cached = bioguideResolutionCache.get(cacheKey)
  if (cached) return cached

  const { current, historical } = await loadLegislators()
  if (current.length === 0 && historical.length === 0) {
    // Legislator load failed entirely. Return null for THIS call but DO NOT
    // cache — the next call should retry the fetch rather than inheriting a
    // poisoned null key for the rest of the warm instance.
    return null
  }

  const normalized = normalizeName(name)
  const parts = normalized.split(' ').filter(Boolean)
  const chamberType: 'sen' | 'rep' = chamber?.toLowerCase() === 'senate' ? 'sen' : 'rep'

  const currentHit = findMatch(current, normalized, parts, chamberType, state)
  if (currentHit) {
    bioguideResolutionCache.set(cacheKey, currentHit)
    return currentHit
  }

  const historicalHit = findMatch(historical, normalized, parts, chamberType, state)
  if (historicalHit) {
    bioguideResolutionCache.set(cacheKey, historicalHit)
    return historicalHit
  }

  // IMPORTANT: do NOT cache null. A transient legislator fetch hiccup at
  // warm-instance startup would otherwise poison every lookup for this
  // name until the instance recycles. Re-matching on a cache miss is cheap.
  return null
}

/**
 * Fetch member photo as a buffer. Tries multiple public sources in order.
 * Uses GET directly (not HEAD) because bioguide.congress.gov rejects HEAD requests.
 *
 * Caching is SUCCESS-ONLY. We deliberately do NOT cache null/failure,
 * because Vercel functions warm-start across requests and a single
 * transient timeout during a parallel bulk regen would otherwise poison
 * every subsequent lookup for that bioguide until the instance recycles.
 *
 * In-flight dedupe collapses concurrent callers onto a single network
 * fetch — critical when runIngestion fires 5 parallel card renders for
 * the same member.
 */
const memberPhotoInFlight = new Map<string, Promise<Buffer | null>>()

export async function fetchMemberPhoto(bioguideId: string): Promise<Buffer | null> {
  // Success cache hit — return immediately
  const cached = memberPhotoCache.get(bioguideId)
  if (cached) return cached

  // Deduplicate concurrent fetches for the same bioguide
  const inFlight = memberPhotoInFlight.get(bioguideId)
  if (inFlight) return inFlight

  const fetchPromise = (async (): Promise<Buffer | null> => {
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
          // 20s: some bioguide portraits are >1MB and can be slow
          // when multiple parallel card renders compete for bandwidth.
          signal: AbortSignal.timeout(20_000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AIProDaily/1.0)',
            Accept: 'image/jpeg,image/*,*/*;q=0.8',
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

    // IMPORTANT: do NOT cache null. See comment above.
    return null
  })()

  memberPhotoInFlight.set(bioguideId, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    memberPhotoInFlight.delete(bioguideId)
  }
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
