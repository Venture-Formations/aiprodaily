import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('BACKEND GET: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    console.log('BACKEND GET: Loading email settings from database for newsletter:', newsletter.id)
    // Get current settings from database (key-value structure)
    const { data: settingsRows, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', newsletter.id)
      .or('key.like.email_%,key.like.criteria_%,key.like.secondary_criteria_%,key.like.primary_criteria_%,key.eq.max_top_articles,key.eq.max_bottom_articles,key.eq.max_secondary_articles,key.eq.primary_article_lookback_hours,key.eq.secondary_article_lookback_hours,key.eq.dedup_historical_lookback_days,key.eq.dedup_strictness_threshold,key.eq.next_ad_position')

    if (error) {
      console.error('BACKEND GET: Database error:', error)
      throw error
    }

    console.log('BACKEND GET: Found settings rows count:', settingsRows?.length || 0)
    console.log('BACKEND GET: Email settings keys found:', settingsRows?.filter(r => r.key.startsWith('email_')).map(r => r.key) || [])

    // Convert rows to object
    const savedSettings: Record<string, string> = {}
    settingsRows?.forEach(row => {
      // Strip extra quotes if value was JSON stringified (e.g., '"20:30"' -> '20:30')
      let cleanValue = row.value
      if (cleanValue && cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
        cleanValue = cleanValue.slice(1, -1)
      }
      if (row.key.startsWith('email_')) {
        const settingKey = row.key.replace('email_', '')
        savedSettings[settingKey] = cleanValue
      } else {
        // Keep max_top_articles, max_bottom_articles, and lookback hours as-is
        savedSettings[row.key] = cleanValue
      }
    })

    console.log('BACKEND GET: Processed saved settings:', savedSettings)

    // Return current settings or defaults
    const defaultSettings = {
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID || '',
      mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID || '',
      fromEmail: 'scoop@stcscoop.com',
      senderName: 'St. Cloud Scoop',
      reviewScheduleEnabled: 'true',
      rssProcessingTime: '20:30',  // 8:30 PM CT
      issueCreationTime: '20:50',  // 8:50 PM CT
      scheduledSendTime: '21:00',  // 9:00 PM CT
      dailyScheduleEnabled: 'false',
      dailyissueCreationTime: '04:30',  // 4:30 AM CT
      dailyScheduledSendTime: '04:55',  // 4:55 AM CT
      primary_article_lookback_hours: '72',  // 72 hours for primary RSS
      secondary_article_lookback_hours: '36',  // 36 hours for secondary RSS
      dedup_historical_lookback_days: '3',  // 3 days of historical checking
      dedup_strictness_threshold: '0.80',  // 80% similarity threshold
      max_top_articles: '3',  // Max articles for primary section
      max_bottom_articles: '3',  // Max articles for bottom section
      max_secondary_articles: '3'  // Max articles for secondary section
    }

    const finalSettings = {
      ...defaultSettings,
      ...savedSettings
    }

    console.log('BACKEND GET: Default schedule times:', {
      rssProcessingTime: defaultSettings.rssProcessingTime,
      issueCreationTime: defaultSettings.issueCreationTime,
      scheduledSendTime: defaultSettings.scheduledSendTime
    })
    console.log('BACKEND GET: Saved schedule times:', {
      rssProcessingTime: savedSettings.rssProcessingTime,
      issueCreationTime: savedSettings.issueCreationTime,
      scheduledSendTime: savedSettings.scheduledSendTime
    })
    console.log('BACKEND GET: Final schedule times:', {
      rssProcessingTime: finalSettings.rssProcessingTime,
      issueCreationTime: finalSettings.issueCreationTime,
      scheduledSendTime: finalSettings.scheduledSendTime
    })

    // Convert flat settings object to array format for frontend compatibility
    const settingsArray = Object.entries(finalSettings).map(([key, value]) => ({
      key,
      value
    }))

    return NextResponse.json({
      ...finalSettings,
      settings: settingsArray
    })

  } catch (error) {
    console.error('Failed to load email settings:', error)
    return NextResponse.json({
      error: 'Failed to load email settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('BACKEND: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const newsletterId = newsletter.id
    console.log('BACKEND: Saving settings for newsletter:', newsletterId)

    const settings = await request.json()
    console.log('BACKEND: Received email settings:', JSON.stringify(settings, null, 2))
    // Check if this is a lookback hours update request
    if (settings.primary_article_lookback_hours !== undefined || settings.secondary_article_lookback_hours !== undefined) {
      const settingsToSave = []

      if (settings.primary_article_lookback_hours !== undefined) {
        settingsToSave.push({
          key: 'primary_article_lookback_hours',
          value: settings.primary_article_lookback_hours.toString()
        })
      }

      if (settings.secondary_article_lookback_hours !== undefined) {
        settingsToSave.push({
          key: 'secondary_article_lookback_hours',
          value: settings.secondary_article_lookback_hours.toString()
        })
      }

      // Upsert lookback hours settings
      for (const setting of settingsToSave) {
        const { error } = await supabaseAdmin
          .from('publication_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            publication_id: newsletterId,
            description: `Article lookback hours: ${setting.key}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })

        if (error) {
          throw error
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Article lookback hours saved successfully'
      })
    }

    // Check if this is a deduplication settings update request
    if (settings.dedup_historical_lookback_days !== undefined || settings.dedup_strictness_threshold !== undefined) {
      const settingsToSave = []

      if (settings.dedup_historical_lookback_days !== undefined) {
        settingsToSave.push({
          key: 'dedup_historical_lookback_days',
          value: settings.dedup_historical_lookback_days.toString()
        })
      }

      if (settings.dedup_strictness_threshold !== undefined) {
        settingsToSave.push({
          key: 'dedup_strictness_threshold',
          value: settings.dedup_strictness_threshold.toString()
        })
      }

      // Upsert deduplication settings
      for (const setting of settingsToSave) {
        const { error } = await supabaseAdmin
          .from('publication_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            publication_id: newsletterId,
            description: setting.key === 'dedup_historical_lookback_days'
              ? 'Number of days of sent newsletters to check for duplicate articles'
              : 'Similarity threshold for all deduplication checks (0.0-1.0)',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })

        if (error) {
          throw error
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Deduplication settings saved successfully'
      })
    }

    // Check if this is a max articles update request
    if (settings.max_top_articles !== undefined || settings.max_bottom_articles !== undefined) {
      // Handle max articles settings separately
      const settingsToSave = []

      if (settings.max_top_articles !== undefined) {
        settingsToSave.push({
          key: 'max_top_articles',
          value: settings.max_top_articles.toString()
        })
      }

      if (settings.max_bottom_articles !== undefined) {
        settingsToSave.push({
          key: 'max_bottom_articles',
          value: settings.max_bottom_articles.toString()
        })
      }

      // Upsert max articles settings
      for (const setting of settingsToSave) {
        const { error } = await supabaseAdmin
          .from('publication_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            publication_id: newsletterId,
            description: `Max articles setting: ${setting.key}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })

        if (error) {
          throw error
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Max articles settings saved successfully'
      })
    }

    // Check if this is a schedule time update request
    const scheduleFields = ['rssProcessingTime', 'issueCreationTime', 'scheduledSendTime',
                           'dailyissueCreationTime', 'dailyScheduledSendTime',
                           'reviewScheduleEnabled', 'dailyScheduleEnabled']
    const isScheduleUpdate = scheduleFields.some(field => settings[field] !== undefined) &&
                            !settings.fromEmail && !settings.senderName

    if (isScheduleUpdate) {
      // Validate time formats (HH:MM)
      const timeFields = ['rssProcessingTime', 'issueCreationTime', 'scheduledSendTime',
                         'dailyissueCreationTime', 'dailyScheduledSendTime']
      for (const field of timeFields) {
        if (settings[field] && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings[field])) {
          return NextResponse.json({
            error: `Invalid time format for ${field}. Use HH:MM format.`
          }, { status: 400 })
        }
      }

      // Save only schedule settings
      const settingsToSave = []
      if (settings.rssProcessingTime !== undefined) {
        settingsToSave.push({ key: 'email_rssProcessingTime', value: settings.rssProcessingTime })
      }
      if (settings.issueCreationTime !== undefined) {
        settingsToSave.push({ key: 'email_issueCreationTime', value: settings.issueCreationTime })
      }
      if (settings.scheduledSendTime !== undefined) {
        settingsToSave.push({ key: 'email_scheduledSendTime', value: settings.scheduledSendTime })
      }
      if (settings.dailyissueCreationTime !== undefined) {
        settingsToSave.push({ key: 'email_dailyissueCreationTime', value: settings.dailyissueCreationTime })
      }
      if (settings.dailyScheduledSendTime !== undefined) {
        settingsToSave.push({ key: 'email_dailyScheduledSendTime', value: settings.dailyScheduledSendTime })
      }
      if (settings.reviewScheduleEnabled !== undefined) {
        settingsToSave.push({ key: 'email_reviewScheduleEnabled', value: settings.reviewScheduleEnabled ? 'true' : 'false' })
      }
      if (settings.dailyScheduleEnabled !== undefined) {
        settingsToSave.push({ key: 'email_dailyScheduleEnabled', value: settings.dailyScheduleEnabled ? 'true' : 'false' })
      }

      // Upsert schedule settings
      for (const setting of settingsToSave) {
        const { error } = await supabaseAdmin
          .from('publication_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            publication_id: newsletterId,
            description: `Email schedule: ${setting.key.replace('email_', '')}`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })

        if (error) {
          throw error
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Schedule settings saved successfully'
      })
    }

    // Validate required fields for email settings
    if (!settings.fromEmail || !settings.senderName) {
      return NextResponse.json({
        error: 'From Email and Sender Name are required'
      }, { status: 400 })
    }

    // Validate time formats (HH:MM)
    const timeFields = ['rssProcessingTime', 'issueCreationTime', 'scheduledSendTime', 'dailyissueCreationTime', 'dailyScheduledSendTime']
    for (const field of timeFields) {
      if (settings[field] && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings[field])) {
        return NextResponse.json({
          error: `Invalid time format for ${field}. Use HH:MM format.`
        }, { status: 400 })
      }
    }

    // Save settings as individual key-value pairs
    const settingsToSave = [
      { key: 'email_reviewGroupId', value: settings.reviewGroupId || '' },
      { key: 'email_mainGroupId', value: settings.mainGroupId || '' },
      { key: 'email_fromEmail', value: settings.fromEmail },
      { key: 'email_senderName', value: settings.senderName },
      { key: 'email_reviewScheduleEnabled', value: settings.reviewScheduleEnabled ? 'true' : 'false' },
      { key: 'email_rssProcessingTime', value: settings.rssProcessingTime },
      { key: 'email_issueCreationTime', value: settings.issueCreationTime },
      { key: 'email_scheduledSendTime', value: settings.scheduledSendTime },
      { key: 'email_dailyScheduleEnabled', value: settings.dailyScheduleEnabled ? 'true' : 'false' },
      { key: 'email_dailyissueCreationTime', value: settings.dailyissueCreationTime },
      { key: 'email_dailyScheduledSendTime', value: settings.dailyScheduledSendTime }
    ]

    // Upsert each setting
    console.log('BACKEND: Saving settings to database:', settingsToSave)
    const savedKeys: string[] = []
    for (const setting of settingsToSave) {
      console.log(`BACKEND: Upserting ${setting.key} = ${setting.value}`)
      const { error, data } = await supabaseAdmin
        .from('publication_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          publication_id: newsletterId,
          description: `Email configuration: ${setting.key.replace('email_', '')}`,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'publication_id,key'
        })
        .select()

      if (error) {
        console.error(`BACKEND: Error saving ${setting.key}:`, error)
        throw error
      }
      console.log(`BACKEND: Successfully saved ${setting.key} = ${setting.value}`)
      savedKeys.push(setting.key)
    }
    console.log('BACKEND: All settings saved. Keys:', savedKeys)

    // Log the settings update
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: 'email_settings_updated',
            details: {
              scheduling_updated: true,
              times: {
                rss: settings.rssProcessingTime,
                issue: settings.issueCreationTime,
                send: settings.scheduledSendTime
              },
              note: 'Subject line generation fixed at RSS+15min'
            }
          }])
      }
    }

    console.log('BACKEND: All settings saved successfully')
    return NextResponse.json({
      success: true,
      message: 'Email settings saved successfully'
    })

  } catch (error) {
    console.error('Failed to save email settings:', error)
    return NextResponse.json({
      error: 'Failed to save email settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
