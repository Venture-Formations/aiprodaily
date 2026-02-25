import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(media)/sync-logo' },
  async ({ logger }) => {
  try {
    // Get logo_url from app_settings
    const { data: logoSetting, error: logoError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'logo_url')
      .single()

    if (logoError) {
      return NextResponse.json({
        error: 'Failed to fetch logo from app_settings',
        details: logoError.message
      }, { status: 500 })
    }

    const logoUrl = logoSetting?.value || null

    // Update newsletters table with logo_url
    const { error: updateError } = await supabaseAdmin
      .from('publications')
      .update({ logo_url: logoUrl })
      .eq('slug', 'accounting')

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update newsletters table',
        details: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Logo synced successfully',
      logo_url: logoUrl
    })

  } catch (error) {
    console.error('Sync logo error:', error)
    return NextResponse.json({
      error: 'Failed to sync logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
