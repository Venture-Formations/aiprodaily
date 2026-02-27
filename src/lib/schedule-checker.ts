import { supabaseAdmin } from './supabase'
import { getScheduleConfig } from './settings/schedule-settings'

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

  private static isTimeToRun(currentTime: string, scheduledTime: string, lastRunKey: string, newsletterId: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const current = this.parseTime(currentTime)
      const scheduled = this.parseTime(scheduledTime)

      // Check if current time matches scheduled time (within 4-minute window)
      // This prevents duplicate runs at scheduled time + 5 minutes
      const currentMinutes = current.hours * 60 + current.minutes
      const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes
      const timeDiff = Math.abs(currentMinutes - scheduledMinutes)

      if (timeDiff > 4) {
        console.log(`Time window not matched for ${lastRunKey}: current ${currentTime}, scheduled ${scheduledTime}, diff ${timeDiff} minutes`)
        resolve(false)
        return
      }

      console.log(`Time window matched for ${lastRunKey}: current ${currentTime}, scheduled ${scheduledTime}, diff ${timeDiff} minutes`)

      // Allow running multiple times per day for testing purposes
      // Only check if time window matches, don't prevent multiple runs per day
      try {
        const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
        const centralDate = new Date(nowCentral)
        const today = centralDate.toISOString().split('T')[0]

        // Update the last run date to today (for logging/tracking purposes only)
        await supabaseAdmin
          .from('publication_settings')
          .upsert({
            publication_id: newsletterId,
            key: lastRunKey,
            value: today,
            description: `Last run date for ${lastRunKey}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })

        console.log(`${lastRunKey} running at ${currentTime} (last run tracking updated to ${today})`)
        resolve(true)
      } catch (error) {
        console.error(`Error updating last run for ${lastRunKey}:`, error)
        // Still allow the run even if tracking update fails
        resolve(true)
      }
    })
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

  static async shouldRunissueCreation(newsletterId: string): Promise<boolean> {
    try {
      const settings = await this.getScheduleSettings(newsletterId)

      if (!settings.reviewScheduleEnabled) {
        return false
      }

      const currentTime = this.getCurrentTimeInCT()
      console.log(`issue Creation check: Current CT time ${currentTime.timeString}, Scheduled: ${settings.issueCreationTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        settings.issueCreationTime,
        'last_issue_creation_run',
        newsletterId
      )
    } catch (error) {
      console.error('Error checking issue creation schedule:', error)
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
      console.log(`Review Send check: Current CT time ${currentTime.timeString}, Scheduled Send Time: ${settings.scheduledSendTime}`)

      return await this.isTimeToRun(
        currentTime.timeString,
        settings.scheduledSendTime,
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
      const scheduled = this.parseTime(settings.scheduledSendTime)

      const currentMinutes = current.hours * 60 + current.minutes
      const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes
      const minutesAfter = currentMinutes - scheduledMinutes

      // Only catch up within 5-30 minutes after scheduled time
      if (minutesAfter < 5 || minutesAfter > 30) return false

      // Check if there's a draft issue for tomorrow with no review_sent_at
      // Use Intl.DateTimeFormat to avoid timezone conversion bugs with toISOString()
      const ctParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date())
      const [ctYear, ctMonth, ctDay] = ctParts.split('-').map(Number)
      const tomorrowDate = new Date(ctYear, ctMonth - 1, ctDay + 1)
      const issueDate = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

      const { data: draftIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, status, review_sent_at')
        .eq('publication_id', newsletterId)
        .eq('date', issueDate)
        .eq('status', 'draft')
        .is('review_sent_at', null)
        .maybeSingle()

      if (draftIssue) {
        console.log(`[ScheduleChecker] Catch-up: Found unsent draft issue ${draftIssue.id} for ${issueDate}, ${minutesAfter} min after scheduled time`)
        return true
      }

      return false
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
        reviewSend: settings.scheduledSendTime,
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