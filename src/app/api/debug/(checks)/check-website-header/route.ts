import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-website-header' },
  async ({ logger }) => {
    // Check if website_header_url exists in database
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['website_header_url', 'header_image_url', 'logo_url'])

    if (error) throw error

    const websiteHeaderUrl = settings?.find(s => s.key === 'website_header_url')
    const headerImageUrl = settings?.find(s => s.key === 'header_image_url')
    const logoUrl = settings?.find(s => s.key === 'logo_url')

    return NextResponse.json({
      success: true,
      settings: {
        website_header_url: websiteHeaderUrl || 'NOT FOUND',
        header_image_url: headerImageUrl || 'NOT FOUND',
        logo_url: logoUrl || 'NOT FOUND'
      },
      raw_settings: settings
    })
  }
)
