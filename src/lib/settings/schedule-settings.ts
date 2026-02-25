import { z } from 'zod'
import {
  getPublicationSettings,
  updatePublicationSetting,
} from '@/lib/publication-settings'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const timeRegex = /^\d{2}:\d{2}$/

export const ScheduleConfigSchema = z.object({
  reviewScheduleEnabled: z.boolean().default(false),
  dailyScheduleEnabled: z.boolean().default(false),
  rssProcessingTime: z.string().regex(timeRegex).default('20:30'),
  issueCreationTime: z.string().regex(timeRegex).default('20:50'),
  scheduledSendTime: z.string().regex(timeRegex).default('21:00'),
  dailyIssueCreationTime: z.string().regex(timeRegex).default('04:30'),
  dailyScheduledSendTime: z.string().regex(timeRegex).default('04:55'),
  timezoneId: z.number().int().positive().default(157),
  secondaryScheduleEnabled: z.boolean().default(false),
  secondaryIssueCreationTime: z.string().regex(timeRegex).default('06:00'),
  secondaryScheduledSendTime: z.string().regex(timeRegex).default('06:30'),
  secondarySendDays: z.array(z.number().int().min(0).max(6)).default([]),
})

export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>

// ---------------------------------------------------------------------------
// DB key <-> schema field mapping
// ---------------------------------------------------------------------------

/**
 * Maps DB `publication_settings` keys to ScheduleConfig fields.
 * DB keys preserve legacy casing (e.g. lowercase `i` in `dailyissueCreationTime`).
 */
export const DB_KEY_MAP: Record<string, keyof ScheduleConfig> = {
  email_reviewScheduleEnabled: 'reviewScheduleEnabled',
  email_dailyScheduleEnabled: 'dailyScheduleEnabled',
  email_rssProcessingTime: 'rssProcessingTime',
  email_issueCreationTime: 'issueCreationTime',
  email_scheduledSendTime: 'scheduledSendTime',
  email_dailyissueCreationTime: 'dailyIssueCreationTime',
  email_dailyScheduledSendTime: 'dailyScheduledSendTime',
  email_timezone_id: 'timezoneId',
  email_secondaryScheduleEnabled: 'secondaryScheduleEnabled',
  email_secondaryissueCreationTime: 'secondaryIssueCreationTime',
  email_secondaryScheduledSendTime: 'secondaryScheduledSendTime',
  secondary_send_days: 'secondarySendDays',
}

/** Reverse map: schema field -> DB key */
export const FIELD_KEY_MAP: Record<keyof ScheduleConfig, string> = Object.fromEntries(
  Object.entries(DB_KEY_MAP).map(([dbKey, field]) => [field, dbKey])
) as Record<keyof ScheduleConfig, string>

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function coerceBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  return value === 'true'
}

function coerceInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? undefined : n
}

function coerceJsonArray(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Getter
// ---------------------------------------------------------------------------

/**
 * Load the full schedule configuration for a publication.
 * Reads raw key-value strings from `publication_settings`, coerces them to
 * typed values, and validates with the Zod schema. Missing or invalid values
 * are replaced with schema defaults.
 */
export async function getScheduleConfig(
  publicationId: string
): Promise<ScheduleConfig> {
  const dbKeys = Object.keys(DB_KEY_MAP)
  const raw = await getPublicationSettings(publicationId, dbKeys)

  // Build a partial object with coerced values
  const partial: Record<string, unknown> = {}

  for (const [dbKey, field] of Object.entries(DB_KEY_MAP)) {
    const value = raw[dbKey]
    if (value === undefined) continue

    switch (field) {
      case 'reviewScheduleEnabled':
      case 'dailyScheduleEnabled':
      case 'secondaryScheduleEnabled':
        partial[field] = coerceBoolean(value)
        break
      case 'timezoneId':
        partial[field] = coerceInt(value)
        break
      case 'secondarySendDays':
        partial[field] = coerceJsonArray(value)
        break
      default:
        // Time strings — pass through (Zod validates the regex)
        partial[field] = value
        break
    }
  }

  // safeParse so invalid values fall back to defaults instead of throwing
  const result = ScheduleConfigSchema.safeParse(partial)
  if (result.success) {
    return result.data
  }

  // If some fields failed validation, strip them and re-parse so defaults kick in
  const cleaned = { ...partial }
  for (const issue of result.error.issues) {
    const key = issue.path[0] as string
    delete cleaned[key]
  }
  return ScheduleConfigSchema.parse(cleaned)
}

// ---------------------------------------------------------------------------
// Setter
// ---------------------------------------------------------------------------

/**
 * Validate and persist a partial schedule configuration update.
 * Only the provided fields are written; other keys are left untouched.
 *
 * Returns `{ success: true }` on success, or `{ success: false, error }` with
 * a Zod-formatted error message on validation failure.
 */
export async function updateScheduleConfig(
  publicationId: string,
  update: Partial<ScheduleConfig>
): Promise<{ success: boolean; error?: string }> {
  const result = ScheduleConfigSchema.partial().safeParse(update)
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    }
  }

  const validated = result.data

  for (const [field, value] of Object.entries(validated)) {
    const dbKey = FIELD_KEY_MAP[field as keyof ScheduleConfig]
    if (!dbKey) continue

    let serialized: string
    if (typeof value === 'boolean') {
      serialized = value ? 'true' : 'false'
    } else if (typeof value === 'number') {
      serialized = value.toString()
    } else if (Array.isArray(value)) {
      serialized = JSON.stringify(value)
    } else {
      serialized = value as string
    }

    const writeResult = await updatePublicationSetting(publicationId, dbKey, serialized)
    if (!writeResult.success) {
      return { success: false, error: `Failed to write ${dbKey}: ${writeResult.error}` }
    }
  }

  return { success: true }
}
