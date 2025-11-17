import { supabaseAdmin } from './supabase'

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
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', newsletterId)
      .in('key', [
        'email_reviewScheduleEnabled',
        'email_dailyScheduleEnabled',
        'email_rssProcessingTime',
        'email_issueCreationTime',
        'email_scheduledSendTime',
        'email_dailyissueCreationTime',
        'email_dailyScheduledSendTime'
      ])

    const settingsMap = (settings || []).reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    return {
      reviewScheduleEnabled: settingsMap['email_reviewScheduleEnabled'] === 'true',
      dailyScheduleEnabled: settingsMap['email_dailyScheduleEnabled'] === 'true',
      rssProcessingTime: settingsMap['email_rssProcessingTime'] || '20:30',
      issueCreationTime: settingsMap['email_issueCreationTime'] || '20:50',
      scheduledSendTime: settingsMap['email_scheduledSendTime'] || '21:00',
      dailyissueCreationTime: settingsMap['email_dailyissueCreationTime'] || '04:30',
      dailyScheduledSendTime: settingsMap['email_dailyScheduledSendTime'] || '04:55'
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
      console.log(`Review Send check: Current CT time ${currentTime.timeString}, issue Creation Time: ${settings.issueCreationTime}`)

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