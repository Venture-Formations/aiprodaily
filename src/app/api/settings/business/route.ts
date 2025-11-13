import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

const BUSINESS_SETTINGS_KEYS = [
  'newsletter_name',
  'business_name',
  'subject_line_emoji',
  'primary_color',
  'secondary_color',
  'header_image_url',
  'website_header_url',
  'logo_url',
  'contact_email',
  'website_url',
  'heading_font',
  'body_font',
  'facebook_enabled',
  'facebook_url',
  'twitter_enabled',
  'twitter_url',
  'linkedin_enabled',
  'linkedin_url',
  'instagram_enabled',
  'instagram_url',
  'mailerlite_group_name',
  'mailerlite_group_id'
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all business settings
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', BUSINESS_SETTINGS_KEYS)

    if (error) {
      throw error
    }

    // Convert array to object
    const settingsObject: Record<string, any> = {}
    settings?.forEach(setting => {
      // Convert string booleans to actual booleans
      if (setting.value === 'true' || setting.value === 'false') {
        settingsObject[setting.key] = setting.value === 'true'
      } else {
        settingsObject[setting.key] = setting.value
      }
    })

    return NextResponse.json(settingsObject)

  } catch (error) {
    console.error('Failed to fetch business settings:', error)
    return NextResponse.json({
      error: 'Failed to fetch business settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Update or insert each setting
    for (const key of BUSINESS_SETTINGS_KEYS) {
      if (body[key] !== undefined) {
        const value = typeof body[key] === 'boolean' ? String(body[key]) : body[key]

        // Try to update first
        const { data: existing } = await supabaseAdmin
          .from('app_settings')
          .select('id')
          .eq('key', key)
          .single()

        if (existing) {
          // Update existing
          await supabaseAdmin
            .from('app_settings')
            .update({ value })
            .eq('key', key)
        } else {
          // Insert new
          await supabaseAdmin
            .from('app_settings')
            .insert([{ key, value }])
        }
      }
    }

    // Sync logo_url to newsletters table if it was updated
    if (body.logo_url !== undefined) {
      await supabaseAdmin
        .from('publications')
        .update({ logo_url: body.logo_url })
        .eq('slug', 'accounting') // Update the accounting newsletter
    }

    return NextResponse.json({
      success: true,
      message: 'Business settings saved successfully'
    })

  } catch (error) {
    console.error('Failed to save business settings:', error)
    return NextResponse.json({
      error: 'Failed to save business settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
