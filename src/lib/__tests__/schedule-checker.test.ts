import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScheduleChecker } from '../schedule-checker'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

vi.mock('../settings/schedule-settings', () => ({
  getScheduleConfig: vi.fn(),
}))

import { getScheduleConfig } from '../settings/schedule-settings'

const mockedGetConfig = vi.mocked(getScheduleConfig)

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// parseTime
// ---------------------------------------------------------------------------
describe('ScheduleChecker.parseTime', () => {
  it('parses "08:30"', () => {
    expect(ScheduleChecker.parseTime('08:30')).toEqual({ hours: 8, minutes: 30 })
  })

  it('parses "00:00"', () => {
    expect(ScheduleChecker.parseTime('00:00')).toEqual({ hours: 0, minutes: 0 })
  })

  it('parses "23:59"', () => {
    expect(ScheduleChecker.parseTime('23:59')).toEqual({ hours: 23, minutes: 59 })
  })

  it('parses "12:00"', () => {
    expect(ScheduleChecker.parseTime('12:00')).toEqual({ hours: 12, minutes: 0 })
  })
})

// ---------------------------------------------------------------------------
// getCurrentTimeInCT
// ---------------------------------------------------------------------------
describe('ScheduleChecker.getCurrentTimeInCT', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns hours, minutes, and timeString', () => {
    const result = ScheduleChecker.getCurrentTimeInCT()
    expect(result).toHaveProperty('hours')
    expect(result).toHaveProperty('minutes')
    expect(result).toHaveProperty('timeString')
    expect(typeof result.hours).toBe('number')
    expect(typeof result.minutes).toBe('number')
    expect(result.timeString).toMatch(/^\d{2}:\d{2}$/)
  })

  it('timeString matches hours and minutes', () => {
    const result = ScheduleChecker.getCurrentTimeInCT()
    const expected = `${result.hours.toString().padStart(2, '0')}:${result.minutes.toString().padStart(2, '0')}`
    expect(result.timeString).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// shouldRunRSSProcessing
// ---------------------------------------------------------------------------
describe('ScheduleChecker.shouldRunRSSProcessing', () => {
  it('returns false when review schedule is disabled', async () => {
    mockedGetConfig.mockResolvedValue({
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

    const result = await ScheduleChecker.shouldRunRSSProcessing('pub-123')
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldRunFinalSend
// ---------------------------------------------------------------------------
describe('ScheduleChecker.shouldRunFinalSend', () => {
  it('returns false when daily schedule is disabled', async () => {
    mockedGetConfig.mockResolvedValue({
      reviewScheduleEnabled: true,
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

    const result = await ScheduleChecker.shouldRunFinalSend('pub-123')
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldRunSubjectGeneration (deprecated)
// ---------------------------------------------------------------------------
describe('ScheduleChecker.shouldRunSubjectGeneration', () => {
  it('always returns false (deprecated)', async () => {
    const result = await ScheduleChecker.shouldRunSubjectGeneration()
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getScheduleSettings
// ---------------------------------------------------------------------------
describe('ScheduleChecker.getScheduleSettings', () => {
  it('maps config fields correctly', async () => {
    mockedGetConfig.mockResolvedValue({
      reviewScheduleEnabled: true,
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

    const settings = await ScheduleChecker.getScheduleSettings('pub-123')
    expect(settings.reviewScheduleEnabled).toBe(true)
    expect(settings.dailyScheduleEnabled).toBe(false)
    expect(settings.rssProcessingTime).toBe('20:30')
    expect(settings.issueCreationTime).toBe('20:50')
    expect(settings.scheduledSendTime).toBe('21:00')
    expect(settings.dailyissueCreationTime).toBe('04:30')
    expect(settings.dailyScheduledSendTime).toBe('04:55')
  })
})
