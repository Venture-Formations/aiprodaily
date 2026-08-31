import { supabaseAdmin } from './supabase'
import { getScheduleConfig } from './settings/schedule-settings'
import { getPublicationOwnSetting, updatePublicationSetting } from './publication-settings'
import { getTodayStr, getTomorrowStr } from './date-utils'

interface ScheduleSettings {
  reviewScheduleEnabled: boolean
  dailyScheduleEnabled: boolean
  rssProcessingTime: string
  issueCreationTime: string
  scheduledSendTime: string
  dailyissueCreationTime: string
  dailyScheduledSendTime: string
}

export class ScheduleChecker {
  public static async getScheduleSettings(newsletterId: string): Promise<ScheduleSettings> {
    const config = await getScheduleConfig(newsletterId)
    return {
      reviewScheduleEnabled: config.reviewScheduleEnabled,
      dailyScheduleEnabled: config.dailyScheduleEnabled,
      rssProcessingTime: config.rssProcessingTime,
      issueCreationTime: config.issueCreationTime,
      scheduledSendTime: config.scheduledSendTime,
      dailyissueCreationTime: config.dailyIssueCreationTime,
      dailyScheduledSendTime: config.dailyScheduledSendTime,
    }
  }

  public static getCurrentTimeInCT(): { hours: number, minutes: number, timeString: string } {
    // Get current time in Central Time
    const now = new Date()
    const centralTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}))
    const hours = centralTime.getHours()
    const minutes = centralTime.getMinutes()
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    return { hours, minutes, timeString }
  }

  public static parseTime(timeStr: string): { hours: number, minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return { hours, minutes }
  }

  /**
   * Minutes after the scheduled time during which a tick still counts as "on time".
   *
   * MUST equal the cron tick period (5 min) minus 1. A forward window of width W
   * spans W+1 consecutive minutes; any 5 consecutive integers contain exactly one
   * multiple of 5, so W=4 admits exactly one tick under any uniform dispatch slip.
   * W=3 spans only 4 minutes, which can contain NO grid tick -- that silently loses
   * the whole day, and for an off-grid schedule minute it loses every day.
   */
  private static readonly RUN_WINDOW_MINUTES = 4

  /**
   * True when this tick is the day's run for `lastRunKey`.
   *
   * Two independent guards, because either alone has failed in production:
   *
   * 1. The window is FORWARD-ONLY. It used to be `Math.abs(diff) > 4`, i.e.
   *    +/-4 minutes, which on a 5-minute cron leaves 60s of margin: with a 19:50
   *    schedule the tick nominally at 19:45 also qualified whenever platform
   *    dispatch slipped and it observed 19:46. Two ticks passed, two workflows ran,
   *    two issues were created for one date, and the newsletter silently stopped
   *    sending. Cron dispatch slips late, never early, so refusing negative diffs
   *    makes the early tick structurally impossible, while keeping the width at a
   *    full tick period guarantees one tick still lands. See RUN_WINDOW_MINUTES.
   *
   * 2. The `last_*_run` marker makes the day idempotent regardless of window math.
   *    This is the guard that absorbs the residual case the window cannot: slip
   *    that VARIES between consecutive ticks can still put two of them in range.
   */
  private static async isTimeToRun(currentTime: string, scheduledTime: string, lastRunKey: string, newsletterId: string): Promise<boolean> {
    const current = this.parseTime(currentTime)
    const scheduled = this.parseTime(scheduledTime)

    const currentMinutes = current.hours * 60 + current.minutes
    const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes

    // Measure "minutes after scheduled" around the clock. Without the wrap, a
    // schedule at 23:56-23:59 would never fire: its window runs past midnight, the
    // 23:55 tick reads negative, and the 00:00 tick reads -1438. Both rejected,
    // every day, silently. A 5-minute-wide window on the circular 1440-minute clock
    // still contains exactly one */5 tick, so the guarantee is unchanged.
    const minutesAfterScheduled = (currentMinutes - scheduledMinutes + 1440) % 1440

    if (minutesAfterScheduled > this.RUN_WINDOW_MINUTES) {
      console.log(`Time window not matched for ${lastRunKey}: current ${currentTime}, scheduled ${scheduledTime}, ${minutesAfterScheduled} minutes after`)
      return false
    }

    console.log(`Time window matched for ${lastRunKey}: current ${currentTime}, scheduled ${scheduledTime}, ${minutesAfterScheduled} minutes after`)

    const today = getTodayStr('CST')

    if (await this.hasRunOn(lastRunKey, newsletterId, today)) {
      console.log(`${lastRunKey} already ran today (${today}) - skipping duplicate run`)
      return false
    }

    // Claim today's slot before returning true, so any later tick backs off.
    const { success, error } = await updatePublicationSetting(newsletterId, lastRunKey, today)
    if (!success) {
      // Fail open: a write blip should not cancel the day's send.
      console.error(`Error updating last run for ${lastRunKey}:`, error)
    } else {
      console.log(`${lastRunKey} running at ${currentTime} (last run marked ${today})`)
    }

    return true
  }

  /**
   * Reads the `last_*_run` marker for this publication.
   *
   * Uses the no-fallback reader deliberately: `getPublicationSetting` would fall
   * back to `app_settings`, which still holds legacy tenant-agnostic `last_*_run`
   * rows from 2025.
   *
   * Fails open (returns false) on a read error so a transient DB blip cannot
   * silently cancel a day's send. This is safe -- do NOT "harden" it to fail
   * closed. The marker is not what prevents a duplicate send: each stage is
   * already idempotent via its own status transition (send-final only selects
   * in_review/changes_made and sets 'sent'; the workflow reuses an existing issue
   * for the date). Failing closed would trade a duplicate that cannot happen for
   * a missed send that can.
   */
  private static async hasRunOn(lastRunKey: string, newsletterId: string, today: string): Promise<boolean> {
    const { value, error } = await getPublicationOwnSetting(newsletterId, lastRunKey)

    if (error) {
      console.error(`Error reading last run for ${lastRunKey}:`, error)
      return false
    }

    return value === today
  }

  static async shouldRunRSSProcessing(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      if (!settings.reviewScheduleEnabled) {
        return false
      }

      const currentTime = this.getCurrentTimeInCT()
      console.log(`RSS Processing check: Current CT time ${currentTime.timeString}, Scheduled: ${settings.rssProcessingTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        settings.rssProcessingTime,
        'last_rss_processing_run',
        newsletterId
      )
    } catch (error) {
      console.error('Error checking RSS processing schedule:', error)
      return false
    }
  }

  static async shouldRunReviewSend(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      if (!settings.reviewScheduleEnabled) {
        return false
      }

      const currentTime = this.getCurrentTimeInCT()
      console.log(`Review Send check: Current CT time ${currentTime.timeString}, Issue Creation Time: ${settings.issueCreationTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        settings.issueCreationTime,
        'last_review_send_run',
        newsletterId
      )
    } catch (error) {
      console.error('Error checking review send schedule:', error)
      return false
    }
  }

  /**
   * Catch-up check: If we're past the scheduled send time (up to 30 min after)
   * and there's a draft issue for tomorrow that hasn't been sent for review,
   * return true so the review send can still happen.
   */
  static async shouldCatchUpReviewSend(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)
      if (!settings.reviewScheduleEnabled) return false

      const currentTime = this.getCurrentTimeInCT()
      const current = this.parseTime(currentTime.timeString)
      const scheduled = this.parseTime(settings.issueCreationTime)

      const currentMinutes = current.hours * 60 + current.minutes
      const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes
      const minutesAfter = currentMinutes - scheduledMinutes

      // Only catch up within 5-30 minutes after issue creation time
      if (minutesAfter < 5 || minutesAfter > 30) return false

      // Check if there's a draft issue for tomorrow with no review_sent_at
      const issueDate = getTomorrowStr('CST')

      // Fetch up to 2. This used to be .maybeSingle(), which returns PGRST116 on
      // multiple rows -- the same collapse that broke send-review. With two drafts
      // for a date it discarded the error and returned false, so the catch-up path
      // was itself disabled by the very duplicates it existed to rescue.
      const { data: draftIssues, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, status, review_sent_at')
        .eq('publication_id', newsletterId)
        .eq('date', issueDate)
        .eq('status', 'draft')
        .is('review_sent_at', null)
        .order('created_at', { ascending: true })
        .limit(2)

      if (error) {
        console.error(`[ScheduleChecker] Catch-up: failed to query draft issue for ${issueDate}:`, error)
        return false
      }

      if (!draftIssues || draftIssues.length === 0) return false

      if (draftIssues.length > 1) {
        console.error(`[ScheduleChecker] Catch-up: ${draftIssues.length} unsent drafts for ${issueDate} (${draftIssues.map(i => i.id).join(', ')}) - refusing to catch up until duplicates are resolved`)
        return false
      }

      console.log(`[ScheduleChecker] Catch-up: Found unsent draft issue ${draftIssues[0].id} for ${issueDate}, ${minutesAfter} min after scheduled time`)
      return true
    } catch (error) {
      console.error('Error in catch-up review send check:', error)
      return false
    }
  }

  static async shouldRunEventPopulation(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      if (!settings.reviewScheduleEnabled) {
        return false
      }

      // Run 5 minutes before RSS processing
      const rssTime = settings.rssProcessingTime
      const [rssHour, rssMinute] = rssTime.split(':').map(Number)
      const eventTime = `${rssHour.toString().padStart(2, '0')}:${(rssMinute - 5).toString().padStart(2, '0')}`

      const currentTime = this.getCurrentTimeInCT()
      console.log(`Event Population check: Current CT time ${currentTime.timeString}, Scheduled: ${eventTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        eventTime,
        'last_event_population_run',
        newsletterId
      )
    } catch (error) {
      console.error('Error checking event population schedule:', error)
      return false
    }
  }


  static async shouldRunFinalSend(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      if (!settings.dailyScheduleEnabled) {
        return false
      }

      const currentTime = this.getCurrentTimeInCT()
      console.log(`Final Send check: Current CT time ${currentTime.timeString}, Daily issue Creation Time: ${settings.dailyissueCreationTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        settings.dailyissueCreationTime,
        'last_final_send_run',
        newsletterId
      )
    } catch (error) {
      console.error('Error checking final send schedule:', error)
      return false
    }
  }

  // NOTE: Subject generation is now integrated into RSS processing
  // This method is kept for potential manual testing or future use
  static async shouldRunSubjectGeneration(): Promise<boolean> {
    console.log('Subject generation is now integrated into RSS processing - this method is deprecated')
    return false
  }

  static async getScheduleDisplay(newsletterId: string): Promise<{
    rssProcessing: string
    subjectGeneration: string
    issueCreation: string
    reviewSend: string
    finalSend: string
    reviewEnabled: boolean
    dailyEnabled: boolean
  }> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      // Subject generation now happens as part of RSS processing (after 60-second delay)
      const subjectGeneration = `${settings.rssProcessingTime} (integrated)`

      return {
        rssProcessing: settings.rssProcessingTime,
        subjectGeneration: subjectGeneration,
        issueCreation: settings.issueCreationTime,
        reviewSend: settings.issueCreationTime,
        finalSend: settings.dailyScheduledSendTime,
        reviewEnabled: settings.reviewScheduleEnabled,
        dailyEnabled: settings.dailyScheduleEnabled
      }
    } catch (error) {
      console.error('Error getting schedule display:', error)
      return {
        rssProcessing: '20:30',
        subjectGeneration: '20:30 (integrated)',
        issueCreation: '20:50',
        reviewSend: '21:00',
        finalSend: '04:55',
        reviewEnabled: false,
        dailyEnabled: false
      }
    }
  }
}