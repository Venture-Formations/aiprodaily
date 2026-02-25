import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// CORS headers for public API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export const GET = withApiHandler(
  { authTier: 'public', logContext: 'public-business-settings' },
  async ({ request, logger }) => {
    // Get domain from headers (Next.js 15 requires await)
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

    // Get publication ID from domain
    const publicationId = await getPublicationByDomain(host) || 'accounting'

    // Fetch all business settings from publication_settings
    const settings = await getPublicationSettings(publicationId, [
      'newsletter_name',
      'business_name',
      'primary_color',
      'secondary_color',
      'tertiary_color',
      'quaternary_color',
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

    // Convert string booleans to actual booleans
    const settingsObject: Record<string, any> = {}
    Object.entries(settings).forEach(([key, value]) => {
      if (value === 'true' || value === 'false') {
        settingsObject[key] = value === 'true'
      } else {
        settingsObject[key] = value
      }
    })

    return NextResponse.json({
      success: true,
      data: settingsObject
    }, {
      headers: corsHeaders
    })
  }
)
