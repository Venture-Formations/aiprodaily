import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScheduleChecker } from '../schedule-checker'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  lastRunValue: null as string | null,
  readError: null as unknown,
  upsertSpy: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: mocks.upsertSpy,
      // select('value').eq(publication_id).eq(key).maybeSingle()
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: mocks.lastRunValue === null ? null : { value: mocks.lastRunValue },
              error: mocks.readError,
            }),
          }),
        }),
      }),
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

// ---------------------------------------------------------------------------
// isTimeToRun: forward-only window + once-per-day guard (via shouldRunRSSProcessing)
//
// Regression: trigger-workflow runs every 5 minutes. The window used to accept
// +/-4 minutes, so against a 19:50 schedule the tick nominally at 19:45 ALSO
// qualified whenever cron dispatch slipped and it observed 19:46. Two ticks
// passed, two issues were created for one date, and the send silently stopped.
// Both guards are exercised here: the early tick is now structurally rejected,
// and the last-run marker makes the day idempotent either way.
// ---------------------------------------------------------------------------
describe('ScheduleChecker.isTimeToRun once-per-day guard', () => {
  const enabledConfig = {
    reviewScheduleEnabled: true,
    dailyScheduleEnabled: true,
    rssProcessingTime: '19:50',
    issueCreationTime: '20:15',
    scheduledSendTime: '20:25',
    dailyIssueCreationTime: '05:25',
    dailyScheduledSendTime: '05:30',
    timezoneId: 157,
    secondaryScheduleEnabled: false,
    secondaryIssueCreationTime: '06:00',
    secondaryScheduledSendTime: '06:30',
    secondarySendDays: [],
  }

  // Evening of 2026-08-30 in America/Chicago (CDT, UTC-5).
  // 19:50 CT on Aug 30 is 00:50 UTC on Aug 31; Date.UTC normalizes the rollover.
  const at = (ctTime: string) => {
    const [hh, mm] = ctTime.split(':').map(Number)
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 30, hh + 5, mm, 0)))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockedGetConfig.mockResolvedValue(enabledConfig)
    mocks.lastRunValue = null
    mocks.readError = null
    mocks.upsertSpy.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs at the scheduled time when it has not run today', async () => {
    at('19:50')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(true)
  })

  it('REGRESSION: rejects the early tick that created duplicate issues', async () => {
    // The 19:45 tick, observed as 19:46 after dispatch slip. Under the old
    // +/-4 window this qualified and produced the second issue for the date.
    at('19:46')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(false)
    expect(mocks.upsertSpy).not.toHaveBeenCalled()
  })

  it('rejects the on-time-but-early tick (19:45 against a 19:50 schedule)', async () => {
    at('19:45')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(false)
    expect(mocks.upsertSpy).not.toHaveBeenCalled()
  })

  it('tolerates late dispatch up to the window width', async () => {
    at('19:53')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(true)
  })

  it('rejects a tick past the window width', async () => {
    at('19:54')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(false)
  })

  it('admits exactly one tick per day across a full 5-minute cron grid', async () => {
    // The property that actually matters: with ticks every 5 minutes and up to
    // 1 minute of slip, exactly one may qualify.
    const accepted: string[] = []
    for (const tick of ['19:40', '19:41', '19:45', '19:46', '19:50', '19:51', '19:55', '19:56']) {
      mocks.lastRunValue = null
      at(tick)
      if (await ScheduleChecker.shouldRunRSSProcessing('pub-123')) accepted.push(tick)
    }
    expect(accepted).toEqual(['19:50', '19:51'])
    // ...and 19:51 only qualifies because the marker was reset; in production the
    // 19:50 run claims the day. Covered by the marker test below.
  })

  it('marks the run with today CT date so the next tick backs off', async () => {
    at('19:50')
    await ScheduleChecker.shouldRunRSSProcessing('pub-123')

    expect(mocks.upsertSpy).toHaveBeenCalledTimes(1)
    expect(mocks.upsertSpy.mock.calls[0][0]).toMatchObject({
      publication_id: 'pub-123',
      key: 'last_rss_processing_run',
      value: '2026-08-30',
    })
  })

  it('REGRESSION: marker blocks a second in-window tick even if the window admits it', async () => {
    mocks.lastRunValue = '2026-08-30'
    at('19:51')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(false)
    expect(mocks.upsertSpy).not.toHaveBeenCalled()
  })

  it('runs again the next day once the marker is stale', async () => {
    mocks.lastRunValue = '2026-08-29'
    at('19:50')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(true)
  })

  it('fails open when the marker read errors, so a DB blip cannot cancel the day', async () => {
    mocks.readError = { message: 'connection reset' }
    at('19:50')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(true)
  })
})
