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
    at('19:54')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(true)
  })

  it('rejects a tick past the window width', async () => {
    at('19:55')
    await expect(ScheduleChecker.shouldRunRSSProcessing('pub-123')).resolves.toBe(false)
  })

  // The property that actually matters. The window must admit EXACTLY ONE of the
  // */5 cron ticks -- never two (duplicate issues, the original bug) and never
  // zero (the whole day is silently lost, which is worse).
  //
  // A forward window of width W spans W+1 consecutive minutes, and any 5
  // consecutive integers contain exactly one multiple of 5. W=4 is therefore the
  // only correct width for a 5-minute cron. W=3 spans 4 minutes, which can contain
  // no tick at all -- and for an off-grid schedule minute, contains none on every
  // single day.
  describe('admits exactly one */5 tick under any uniform dispatch slip', () => {
    // Cover every residue of the scheduled minute mod 5, not just grid-aligned
    // times. The settings UI restricts to 5-minute steps but the API's timeRegex
    // does not, so an off-grid time is reachable.
    for (const scheduled of ['19:50', '19:51', '19:52', '19:53', '19:54']) {
      for (const slip of [0, 1, 2, 3, 4]) {
        it(`schedule ${scheduled}, ${slip}m dispatch slip`, async () => {
          mockedGetConfig.mockResolvedValue({ ...enabledConfig, rssProcessingTime: scheduled })

          const admitted: number[] = []
          // Every cron tick in the hour, each observed `slip` minutes late.
          for (let gridMinute = 0; gridMinute < 60; gridMinute += 5) {
            mocks.lastRunValue = null // isolate the window from the marker
            vi.setSystemTime(new Date(Date.UTC(2026, 7, 30, 19 + 5, gridMinute + slip, 0)))
            if (await ScheduleChecker.shouldRunRSSProcessing('pub-123')) admitted.push(gridMinute)
          }

          expect(admitted).toHaveLength(1)
        })
      }
    }
  })

  // Regression: the forward-only window is measured around the clock. A schedule
  // whose window crosses midnight (23:56-23:59) would otherwise never fire -- the
  // 23:55 tick reads negative and the 00:00 tick reads -1438, both rejected, every
  // day, silently. The old Math.abs() window did not have this hole.
  describe('fires for schedules whose window crosses midnight', () => {
    for (const scheduled of ['23:56', '23:57', '23:58', '23:59']) {
      for (const slip of [0, 1, 2, 3, 4]) {
        it(`schedule ${scheduled}, ${slip}m dispatch slip`, async () => {
          mockedGetConfig.mockResolvedValue({ ...enabledConfig, rssProcessingTime: scheduled })

          const admitted: string[] = []
          // Sweep every tick from 23:00 CT through 00:55 CT the next morning.
          for (let gridMinute = 0; gridMinute < 120; gridMinute += 5) {
            mocks.lastRunValue = null
            // 23:00 CT on 2026-08-30 == 04:00 UTC on 2026-08-31 (CDT, UTC-5)
            vi.setSystemTime(new Date(Date.UTC(2026, 7, 31, 4, gridMinute + slip, 0)))
            if (await ScheduleChecker.shouldRunRSSProcessing('pub-123')) {
              admitted.push(ScheduleChecker.getCurrentTimeInCT().timeString)
            }
          }

          expect(admitted).toHaveLength(1)
        })
      }
    }
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
