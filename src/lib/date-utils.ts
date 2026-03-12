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
