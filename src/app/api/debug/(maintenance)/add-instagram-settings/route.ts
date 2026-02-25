import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/add-instagram-settings' },
  async ({ logger }) => {
  try {
    console.log('Adding Instagram settings to app_settings table...')

    // Add instagram_enabled setting
    const { data: instagramEnabled, error: enabledError } = await supabaseAdmin
      .from('app_settings')
      .upsert([
        {
          key: 'instagram_enabled',
          value: 'false'
        }
      ], {
        onConflict: 'key',
        ignoreDuplicates: false
      })
      .select()

    if (enabledError) {
      console.error('Error adding instagram_enabled:', enabledError)
      throw enabledError
    }

    // Add instagram_url setting
    const { data: instagramUrl, error: urlError } = await supabaseAdmin
      .from('app_settings')
      .upsert([
        {
          key: 'instagram_url',
          value: ''
        }
      ], {
        onConflict: 'key',
        ignoreDuplicates: false
      })
      .select()

    if (urlError) {
      console.error('Error adding instagram_url:', urlError)
      throw urlError
    }

    console.log('Instagram settings added successfully')

    return NextResponse.json({
      success: true,
      message: 'Instagram settings added to app_settings table',
      instagram_enabled: instagramEnabled,
      instagram_url: instagramUrl
    })

  } catch (error) {
    console.error('Failed to add Instagram settings:', error)
    return NextResponse.json({
      error: 'Failed to add Instagram settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
