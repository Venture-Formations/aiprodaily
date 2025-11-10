import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const correctLogoUrl = 'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/business/business-logo-1761056643605.png'

    // Update logo_url
    const { error: logoError } = await supabaseAdmin
      .from('app_settings')
      .update({ value: correctLogoUrl })
      .eq('key', 'logo_url')

    if (logoError) throw logoError

    // Update website_header_url
    const { error: websiteHeaderError } = await supabaseAdmin
      .from('app_settings')
      .update({ value: correctLogoUrl })
      .eq('key', 'website_header_url')

    if (websiteHeaderError) throw websiteHeaderError

    // Update header_image_url (for emails)
    const { error: headerError } = await supabaseAdmin
      .from('app_settings')
      .update({ value: correctLogoUrl })
      .eq('key', 'header_image_url')

    if (headerError) throw headerError

    return NextResponse.json({
      success: true,
      message: 'Updated all image URLs to correct GitHub path',
      url: correctLogoUrl
    })
  } catch (error) {
    console.error('Error updating image URLs:', error)
    return NextResponse.json({
      error: 'Failed to update image URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
