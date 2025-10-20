import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('Checking social media settings...')

    // Fetch all social media settings
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'facebook_enabled', 'facebook_url',
        'twitter_enabled', 'twitter_url',
        'linkedin_enabled', 'linkedin_url',
        'instagram_enabled', 'instagram_url'
      ])

    if (error) {
      throw error
    }

    // Convert to object for easier reading
    const settingsMap: Record<string, string> = {}
    settings?.forEach(setting => {
      settingsMap[setting.key] = setting.value
    })

    // Test if images exist at GitHub URLs
    const imageUrls = [
      'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/facebook_light.png',
      'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/twitter_light.png',
      'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/linkedin_light.png',
      'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/instagram_light.png'
    ]

    const imageTests = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD' })
          return {
            url,
            exists: response.ok,
            status: response.status
          }
        } catch (error) {
          return {
            url,
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    // Check which icons should appear based on settings
    const iconLogic = {
      facebook: {
        enabled: settingsMap.facebook_enabled === 'true',
        hasUrl: !!settingsMap.facebook_url,
        shouldShow: settingsMap.facebook_enabled === 'true' && !!settingsMap.facebook_url,
        url: settingsMap.facebook_url
      },
      twitter: {
        enabled: settingsMap.twitter_enabled === 'true',
        hasUrl: !!settingsMap.twitter_url,
        shouldShow: settingsMap.twitter_enabled === 'true' && !!settingsMap.twitter_url,
        url: settingsMap.twitter_url
      },
      linkedin: {
        enabled: settingsMap.linkedin_enabled === 'true',
        hasUrl: !!settingsMap.linkedin_url,
        shouldShow: settingsMap.linkedin_enabled === 'true' && !!settingsMap.linkedin_url,
        url: settingsMap.linkedin_url
      },
      instagram: {
        enabled: settingsMap.instagram_enabled === 'true',
        hasUrl: !!settingsMap.instagram_url,
        shouldShow: settingsMap.instagram_enabled === 'true' && !!settingsMap.instagram_url,
        url: settingsMap.instagram_url
      }
    }

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      iconLogic,
      imageTests,
      summary: {
        totalIconsEnabled: Object.values(iconLogic).filter(i => i.shouldShow).length,
        missingImages: imageTests.filter(t => !t.exists).map(t => t.url)
      }
    })

  } catch (error) {
    console.error('Failed to check social media settings:', error)
    return NextResponse.json({
      error: 'Failed to check social media settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
