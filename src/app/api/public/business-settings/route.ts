import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// CORS headers for public API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    // Fetch all business settings
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'newsletter_name',
        'business_name',
        'primary_color',
        'secondary_color',
        'header_image_url',
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
        'linkedin_url'
      ])

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

    return NextResponse.json({
      success: true,
      data: settingsObject
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Failed to fetch public business settings:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch business settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: corsHeaders
    })
  }
}
