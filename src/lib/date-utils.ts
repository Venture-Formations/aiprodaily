/** Format a Date as YYYY-MM-DD using local date parts (avoids UTC shift from toISOString) */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Default project timezone (Central Time, matches MailerLite/cron conventions) */
const PROJECT_TIMEZONE = 'America/Chicago'

/** Reusable formatter: converts a UTC timestamp to YYYY-MM-DD in the project timezone */
const tzDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: PROJECT_TIMEZONE })

/** Convert a UTC timestamp string to a YYYY-MM-DD date in the project timezone */
export function toProjectDateStr(utcTimestamp: string): string {
  return tzDateFormatter.format(new Date(utcTimestamp))
}

// --- Timezone-aware date range helpers ---

export type SupportedTz = 'CST' | 'UTC'

/**
 * Get the UTC offset in milliseconds for a given date in America/Chicago.
 * Handles CST (UTC-6) vs CDT (UTC-5) automatically via Intl.
 */
function getChicagoOffsetMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Create a date at noon UTC to avoid DST transition edge cases
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))

  // Get the local time string in Chicago and compare to UTC to derive offset
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PROJECT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(probe)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  const localAtProbe = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return probe.getTime() - localAtProbe
}

/**
 * Build UTC-aligned start/end Date boundaries for a YYYY-MM-DD date range
 * in the given display timezone. DST-aware for CST/CDT.
 *
 * Returns { startDate, endDate } where:
 *   startDate = midnight of `startStr` in the selected timezone (as UTC Date)
 *   endDate = 23:59:59.999 of `endStr` in the selected timezone (as UTC Date)
 */
export function buildDateRangeBoundaries(
  startStr: string,
  endStr: string,
  tz: SupportedTz
): { startDate: Date; endDate: Date } {
  if (tz === 'UTC') {
    const startDate = new Date(`${startStr}T00:00:00.000Z`)
    const endDate = new Date(`${endStr}T23:59:59.999Z`)
    return { startDate, endDate }
  }

  // For CT: find the UTC time that corresponds to midnight local on each date
  const startOffsetMs = getChicagoOffsetMs(startStr)
  const endOffsetMs = getChicagoOffsetMs(endStr)

  const [sy, sm, sd] = startStr.split('-').map(Number)
  const [ey, em, ed] = endStr.split('-').map(Number)

  const startDate = new Date(Date.UTC(sy, sm - 1, sd) + startOffsetMs)
  const endDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999) + endOffsetMs)

  return { startDate, endDate }
}

/**
 * Get today's date string in the given timezone.
 */
export function getTodayStr(tz: SupportedTz): string {
  if (tz === 'UTC') {
    return toLocalDateStr(new Date())  // Server is UTC on Vercel
  }
  return tzDateFormatter.format(new Date())  // America/Chicago
}

/**
 * Get a date string N days ago in the given timezone.
 */
export function getDaysAgoStr(days: number, tz: SupportedTz): string {
  const now = new Date()
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  if (tz === 'UTC') {
    return toLocalDateStr(shifted)
  }
  return tzDateFormatter.format(shifted)
}
