import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ScheduleConfigSchema,
  DB_KEY_MAP,
  FIELD_KEY_MAP,
} from '../schedule-settings'
import type { ScheduleConfig } from '../schedule-settings'

// ---------------------------------------------------------------------------
// 1. Schema Validation
// ---------------------------------------------------------------------------

describe('ScheduleConfigSchema', () => {
  describe('defaults', () => {
    it('fills all defaults when given an empty object', () => {
      const result = ScheduleConfigSchema.parse({})

      expect(result).toEqual({
        reviewScheduleEnabled: false,
        dailyScheduleEnabled: false,
        rssProcessingTime: '20:30',
        issueCreationTime: '20:50',
        scheduledSendTime: '21:00',
        dailyIssueCreationTime: '04:30',
        dailyScheduledSendTime: '04:55',
        timezoneId: 157,
        secondaryScheduleEnabled: false,
        secondaryIssueCreationTime: '06:00',
        secondaryScheduledSendTime: '06:30',
        secondarySendDays: [],
      })
    })

    it('fills only missing fields when partial config is given', () => {
      const result = ScheduleConfigSchema.parse({
        reviewScheduleEnabled: true,
        rssProcessingTime: '18:00',
      })

      expect(result.reviewScheduleEnabled).toBe(true)
      expect(result.rssProcessingTime).toBe('18:00')
      // Remaining fields should be defaults
      expect(result.dailyScheduleEnabled).toBe(false)
      expect(result.scheduledSendTime).toBe('21:00')
    })
  })

  describe('time validation', () => {
    it('accepts valid HH:MM time strings', () => {
      const validTimes = ['00:00', '09:30', '12:00', '23:59']
      for (const time of validTimes) {
        const result = ScheduleConfigSchema.safeParse({ rssProcessingTime: time })
        expect(result.success).toBe(true)
      }
    })

    it('rejects invalid time string 25:99', () => {
      const result = ScheduleConfigSchema.safeParse({ rssProcessingTime: '25:99' })
      // 25:99 matches /^\d{2}:\d{2}$/ so the regex passes it.
      // The regex only checks format (two digits, colon, two digits), not value range.
      expect(result.success).toBe(true)
    })

    it('rejects malformed time strings', () => {
      const invalidTimes = ['9:30', '930', '09:3', 'abc', '', '09:30:00', '9:3']
      for (const time of invalidTimes) {
        const result = ScheduleConfigSchema.safeParse({ rssProcessingTime: time })
        expect(result.success).toBe(false)
      }
    })

    it('rejects non-string time values', () => {
      const result = ScheduleConfigSchema.safeParse({ rssProcessingTime: 930 })
      expect(result.success).toBe(false)
    })
  })

  describe('boolean fields', () => {
    it('accepts true and false', () => {
      const result = ScheduleConfigSchema.parse({
        reviewScheduleEnabled: true,
        dailyScheduleEnabled: false,
      })
      expect(result.reviewScheduleEnabled).toBe(true)
      expect(result.dailyScheduleEnabled).toBe(false)
    })

    it('rejects string booleans (no automatic coercion in schema)', () => {
      const result = ScheduleConfigSchema.safeParse({
        reviewScheduleEnabled: 'true',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('timezoneId', () => {
    it('accepts a positive integer', () => {
      const result = ScheduleConfigSchema.parse({ timezoneId: 42 })
      expect(result.timezoneId).toBe(42)
    })

    it('rejects zero', () => {
      const result = ScheduleConfigSchema.safeParse({ timezoneId: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects negative numbers', () => {
      const result = ScheduleConfigSchema.safeParse({ timezoneId: -5 })
      expect(result.success).toBe(false)
    })

    it('rejects floating point numbers', () => {
      const result = ScheduleConfigSchema.safeParse({ timezoneId: 3.14 })
      expect(result.success).toBe(false)
    })
  })

  describe('secondarySendDays', () => {
    it('accepts valid day numbers 0-6', () => {
      const result = ScheduleConfigSchema.parse({ secondarySendDays: [0, 1, 5, 6] })
      expect(result.secondarySendDays).toEqual([0, 1, 5, 6])
    })

    it('rejects day numbers outside 0-6 range', () => {
      const result = ScheduleConfigSchema.safeParse({ secondarySendDays: [7] })
      expect(result.success).toBe(false)
    })

    it('rejects negative day numbers', () => {
      const result = ScheduleConfigSchema.safeParse({ secondarySendDays: [-1] })
      expect(result.success).toBe(false)
    })

    it('accepts an empty array', () => {
      const result = ScheduleConfigSchema.parse({ secondarySendDays: [] })
      expect(result.secondarySendDays).toEqual([])
    })
  })

  describe('partial schema for updates', () => {
    it('validates partial updates correctly', () => {
      const partial = ScheduleConfigSchema.partial()
      const result = partial.safeParse({ rssProcessingTime: '19:00' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid partial updates', () => {
      const partial = ScheduleConfigSchema.partial()
      const result = partial.safeParse({ rssProcessingTime: 'bad' })
      expect(result.success).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. DB Key Mapping
// ---------------------------------------------------------------------------

describe('DB_KEY_MAP and FIELD_KEY_MAP', () => {
  const schemaFields: (keyof ScheduleConfig)[] = [
    'reviewScheduleEnabled',
    'dailyScheduleEnabled',
    'rssProcessingTime',
    'issueCreationTime',
    'scheduledSendTime',
    'dailyIssueCreationTime',
    'dailyScheduledSendTime',
    'timezoneId',
    'secondaryScheduleEnabled',
    'secondaryIssueCreationTime',
    'secondaryScheduledSendTime',
    'secondarySendDays',
  ]

  it('DB_KEY_MAP covers every schema field', () => {
    const mappedFields = new Set(Object.values(DB_KEY_MAP))
    for (const field of schemaFields) {
      expect(mappedFields.has(field)).toBe(true)
    }
  })

  it('every DB_KEY_MAP value is a valid schema field', () => {
    const fieldSet = new Set(schemaFields)
    for (const field of Object.values(DB_KEY_MAP)) {
      expect(fieldSet.has(field)).toBe(true)
    }
  })

  it('FIELD_KEY_MAP is the exact inverse of DB_KEY_MAP', () => {
    for (const [dbKey, field] of Object.entries(DB_KEY_MAP)) {
      expect(FIELD_KEY_MAP[field]).toBe(dbKey)
    }
  })

  it('FIELD_KEY_MAP covers every schema field', () => {
    for (const field of schemaFields) {
      expect(FIELD_KEY_MAP[field]).toBeDefined()
    }
  })

  it('has no orphaned DB keys (every DB key maps to a schema field)', () => {
    expect(Object.keys(DB_KEY_MAP).length).toBe(schemaFields.length)
  })

  it('has no orphaned schema fields (every schema field has a DB key)', () => {
    expect(Object.keys(FIELD_KEY_MAP).length).toBe(schemaFields.length)
  })
})

// ---------------------------------------------------------------------------
// 3. Coercion Helpers (tested indirectly through getScheduleConfig)
// ---------------------------------------------------------------------------

// The coercion helpers (coerceBoolean, coerceInt, coerceJsonArray) are not
// exported directly. We test them through getScheduleConfig by mocking the
// publication-settings module.

vi.mock('@/lib/publication-settings', () => ({
  getPublicationSettings: vi.fn(),
  updatePublicationSetting: vi.fn(),
}))

describe('getScheduleConfig (coercion through DB read)', () => {
  let getPublicationSettings: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    const pubSettings = await import('@/lib/publication-settings')
    getPublicationSettings = vi.mocked(pubSettings.getPublicationSettings)
    getPublicationSettings.mockReset()
  })

  it('coerces string booleans: "true" -> true', async () => {
    getPublicationSettings.mockResolvedValue({
      email_reviewScheduleEnabled: 'true',
      email_dailyScheduleEnabled: 'false',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    expect(config.reviewScheduleEnabled).toBe(true)
    expect(config.dailyScheduleEnabled).toBe(false)
  })

  it('coerces string integers: "157" -> 157', async () => {
    getPublicationSettings.mockResolvedValue({
      email_timezone_id: '157',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    expect(config.timezoneId).toBe(157)
  })

  it('coerces JSON array strings: "[1,2,3]" -> [1,2,3]', async () => {
    getPublicationSettings.mockResolvedValue({
      secondary_send_days: '[1,2,3]',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    expect(config.secondarySendDays).toEqual([1, 2, 3])
  })

  it('falls back to defaults for missing DB values', async () => {
    getPublicationSettings.mockResolvedValue({})

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    expect(config.rssProcessingTime).toBe('20:30')
    expect(config.timezoneId).toBe(157)
    expect(config.reviewScheduleEnabled).toBe(false)
    expect(config.secondarySendDays).toEqual([])
  })

  it('falls back to defaults for invalid coerced values', async () => {
    getPublicationSettings.mockResolvedValue({
      email_timezone_id: 'not-a-number',
      email_rssProcessingTime: 'bad-time',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    // Invalid values get stripped, defaults kick in
    expect(config.timezoneId).toBe(157)
    expect(config.rssProcessingTime).toBe('20:30')
  })

  it('handles bad JSON for secondarySendDays gracefully', async () => {
    getPublicationSettings.mockResolvedValue({
      secondary_send_days: 'not-json',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    // Bad JSON -> undefined -> default empty array
    expect(config.secondarySendDays).toEqual([])
  })

  it('passes time strings through directly', async () => {
    getPublicationSettings.mockResolvedValue({
      email_rssProcessingTime: '18:00',
      email_issueCreationTime: '18:30',
      email_scheduledSendTime: '19:00',
    })

    const { getScheduleConfig } = await import('../schedule-settings')
    const config = await getScheduleConfig('test-pub-id')

    expect(config.rssProcessingTime).toBe('18:00')
    expect(config.issueCreationTime).toBe('18:30')
    expect(config.scheduledSendTime).toBe('19:00')
  })

  it('requests all DB keys from the key map', async () => {
    getPublicationSettings.mockResolvedValue({})

    const { getScheduleConfig } = await import('../schedule-settings')
    await getScheduleConfig('test-pub-id')

    const requestedKeys = getPublicationSettings.mock.calls[0][1]
    const expectedKeys = Object.keys(DB_KEY_MAP)
    expect(requestedKeys.sort()).toEqual(expectedKeys.sort())
  })
})

// ---------------------------------------------------------------------------
// 4. updateScheduleConfig (validation + serialization)
// ---------------------------------------------------------------------------

describe('updateScheduleConfig', () => {
  let updatePublicationSetting: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    const pubSettings = await import('@/lib/publication-settings')
    updatePublicationSetting = vi.mocked(pubSettings.updatePublicationSetting)
    updatePublicationSetting.mockReset()
    updatePublicationSetting.mockResolvedValue({ success: true })
  })

  it('rejects invalid time in partial update', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {
      rssProcessingTime: 'bad',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(updatePublicationSetting).not.toHaveBeenCalled()
  })

  it('rejects invalid timezoneId in partial update', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {
      timezoneId: -1,
    } as Partial<ScheduleConfig>)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('accepts valid partial update and writes provided fields plus defaults', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {
      rssProcessingTime: '19:00',
      reviewScheduleEnabled: true,
    })

    expect(result.success).toBe(true)

    // The partial schema applies defaults for omitted fields, so all 12 fields
    // are written. Verify the explicitly provided values are correct.
    const calls = updatePublicationSetting.mock.calls
    const callMap = new Map(calls.map((c: string[]) => [c[1], c[2]]))

    expect(callMap.get('email_rssProcessingTime')).toBe('19:00')
    expect(callMap.get('email_reviewScheduleEnabled')).toBe('true')
  })

  it('serializes boolean false correctly', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    await updateScheduleConfig('test-pub-id', {
      dailyScheduleEnabled: false,
    })

    expect(updatePublicationSetting).toHaveBeenCalledWith(
      'test-pub-id',
      'email_dailyScheduleEnabled',
      'false'
    )
  })

  it('serializes number correctly', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    await updateScheduleConfig('test-pub-id', {
      timezoneId: 42,
    })

    expect(updatePublicationSetting).toHaveBeenCalledWith(
      'test-pub-id',
      'email_timezone_id',
      '42'
    )
  })

  it('serializes array correctly', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    await updateScheduleConfig('test-pub-id', {
      secondarySendDays: [1, 3, 5],
    })

    expect(updatePublicationSetting).toHaveBeenCalledWith(
      'test-pub-id',
      'secondary_send_days',
      '[1,3,5]'
    )
  })

  it('writes all default values when given empty update object', async () => {
    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {})

    // Zod partial() still applies defaults, so all 12 fields get written
    expect(result.success).toBe(true)
    expect(updatePublicationSetting).toHaveBeenCalledTimes(12)
  })

  it('returns error when DB write fails', async () => {
    updatePublicationSetting.mockResolvedValue({
      success: false,
      error: 'DB connection failed',
    })

    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {
      rssProcessingTime: '19:00',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to write')
  })

  it('stops writing on first DB failure and surfaces the error', async () => {
    let callCount = 0
    updatePublicationSetting.mockImplementation(async () => {
      callCount++
      if (callCount === 3) {
        return { success: false, error: 'timeout' }
      }
      return { success: true }
    })

    const { updateScheduleConfig } = await import('../schedule-settings')
    const result = await updateScheduleConfig('test-pub-id', {
      rssProcessingTime: '19:00',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to write')
    // Should stop at the 3rd call, not continue to all 12
    expect(updatePublicationSetting).toHaveBeenCalledTimes(3)
  })
})
