import { supabaseAdmin } from './supabase'
import type { Advertisement } from '@/types/database'

interface ScheduleContext {
  campaignDate: string // YYYY-MM-DD format
  campaignId: string
}

/**
 * Ad Scheduler - Selects which advertisement should appear in a given campaign
 *
 * New Sequential Ordering System:
 * - Ads are selected based on display_order (1, 2, 3, etc.)
 * - Tracks next_ad_position in app_settings
 * - Loops back to position 1 when reaching the end
 * - Only selects from active ads with valid display_order
 */
export class AdScheduler {
  /**
   * Select the next ad in the rotation queue
   */
  static async selectAdForCampaign(context: ScheduleContext): Promise<Advertisement | null> {
    const { campaignId } = context

    try {
      // Get the current next_ad_position from app_settings
      const { data: settingsData, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'next_ad_position')
        .single()

      if (settingsError) {
        console.error('[AdScheduler] Error fetching next_ad_position:', settingsError)
        return null
      }

      const nextAdPosition = settingsData ? parseInt(settingsData.value) : 1
      console.log(`[AdScheduler] Current next_ad_position: ${nextAdPosition}`)

      // Get all active ads with display_order, sorted by display_order
      const { data: activeAds, error: adsError } = await supabaseAdmin
        .from('advertisements')
        .select('*')
        .eq('status', 'active')
        .not('display_order', 'is', null)
        .order('display_order', { ascending: true })

      if (adsError || !activeAds || activeAds.length === 0) {
        console.log('[AdScheduler] No active ads found:', adsError)
        return null
      }

      console.log(`[AdScheduler] Found ${activeAds.length} active ads`)

      // Find the ad at the current position
      let selectedAd = activeAds.find(ad => ad.display_order === nextAdPosition)

      // If no ad at current position (gap in sequence), find next available position
      if (!selectedAd) {
        console.log(`[AdScheduler] No ad at position ${nextAdPosition}, finding next available...`)
        // Find the first ad with display_order >= nextAdPosition
        selectedAd = activeAds.find(ad => (ad.display_order || 0) >= nextAdPosition)

        // If still none found, we've reached the end - loop back to position 1
        if (!selectedAd) {
          console.log('[AdScheduler] Reached end of queue, looping back to position 1')
          selectedAd = activeAds[0] // First ad in sorted array
        }
      }

      if (!selectedAd) {
        console.log('[AdScheduler] No ad could be selected')
        return null
      }

      console.log(`[AdScheduler] Selected ad: ${selectedAd.title} (position ${selectedAd.display_order})`)

      return selectedAd
    } catch (error) {
      console.error('[AdScheduler] Error selecting ad:', error)
      return null
    }
  }

  /**
   * Record that an ad was used in a campaign and increment next_ad_position
   */
  static async recordAdUsage(
    campaignId: string,
    adId: string,
    campaignDate: string
  ): Promise<void> {
    try {
      // Get the ad that was just used
      const { data: usedAd, error: adError } = await supabaseAdmin
        .from('advertisements')
        .select('display_order, times_used')
        .eq('id', adId)
        .single()

      if (adError || !usedAd) {
        console.error('[AdScheduler] Failed to fetch used ad:', adError)
        throw adError
      }

      console.log(`[AdScheduler] Recording usage for ad at position ${usedAd.display_order}`)

      // Insert into campaign_advertisements
      const { error: insertError } = await supabaseAdmin
        .from('campaign_advertisements')
        .insert({
          campaign_id: campaignId,
          advertisement_id: adId,
          campaign_date: campaignDate,
          used_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('[AdScheduler] Failed to record usage:', insertError)
        throw insertError
      }

      // Update the ad: increment times_used and set last_used_date
      const newTimesUsed = (usedAd.times_used || 0) + 1
      const { error: updateAdError } = await supabaseAdmin
        .from('advertisements')
        .update({
          times_used: newTimesUsed,
          last_used_date: campaignDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', adId)

      if (updateAdError) {
        console.error('[AdScheduler] Failed to update ad times_used:', updateAdError)
      }

      // Calculate next position
      const currentPosition = usedAd.display_order || 1

      // Get all active ads to determine next position
      const { data: activeAds, error: adsError } = await supabaseAdmin
        .from('advertisements')
        .select('display_order')
        .eq('status', 'active')
        .not('display_order', 'is', null)
        .order('display_order', { ascending: true })

      if (adsError || !activeAds || activeAds.length === 0) {
        console.error('[AdScheduler] Failed to fetch active ads for next position:', adsError)
        return
      }

      // Find the next position in the sequence
      let nextPosition = currentPosition + 1
      const maxPosition = Math.max(...activeAds.map(ad => ad.display_order || 0))

      // If we've gone past the max position, loop back to 1
      if (nextPosition > maxPosition) {
        nextPosition = 1
        console.log('[AdScheduler] Reached end of rotation, looping back to position 1')
      } else {
        console.log(`[AdScheduler] Moving to next position: ${nextPosition}`)
      }

      // Update next_ad_position in app_settings
      const { error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .update({
          value: nextPosition.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'next_ad_position')

      if (settingsError) {
        console.error('[AdScheduler] Failed to update next_ad_position:', settingsError)
        throw settingsError
      }

      console.log(`[AdScheduler] Successfully recorded usage and updated next_ad_position to ${nextPosition}`)
    } catch (error) {
      console.error('[AdScheduler] Error in recordAdUsage:', error)
      throw error
    }
  }
}
