import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { generateAdvertorialHtml } from '@/lib/newsletter-templates'
import { getBusinessSettings } from '@/lib/publication-settings'

// GET - Generate ad preview HTML using the shared generateAdvertorialHtml function
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ads/[id]/preview' },
  async ({ params, logger }) => {
    const id = params.id

    // Fetch the ad
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .select('*, publication_id')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    // Get publication_id from ad or use default
    const publication_id = ad.publication_id

    // Fetch business settings for styling
    let primaryColor = '#1877F2'
    let headingFont = 'Arial, sans-serif'
    let bodyFont = 'Arial, sans-serif'

    if (publication_id) {
      const settings = await getBusinessSettings(publication_id)
      primaryColor = settings.primary_color || primaryColor
      headingFont = settings.heading_font || headingFont
      bodyFont = settings.body_font || bodyFont
    } else {
      // Fallback to app_settings
      const { data: settingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['primary_color', 'heading_font', 'body_font'])

      const settingsMap: Record<string, string> = {}
      settingsData?.forEach(setting => {
        settingsMap[setting.key] = setting.value
      })

      primaryColor = settingsMap.primary_color || primaryColor
      headingFont = settingsMap.heading_font || headingFont
      bodyFont = settingsMap.body_font || bodyFont
    }

    // Generate the advertorial HTML using the shared function
    // For preview, we use the raw button_url (no tracking)
    const advertorialHtml = generateAdvertorialHtml(
      {
        title: ad.title,
        body: ad.body || '',
        button_url: ad.button_url || '#',
        image_url: ad.image_url
      },
      {
        primaryColor,
        headingFont,
        bodyFont,
        sectionName: 'Advertorial'
        // No linkUrl - will use button_url directly (no tracking for preview)
      }
    )

    // Build the full HTML page wrapper for the iframe
    const html = `
<!DOCTYPE html>
<html style="margin:0;padding:0;background-color:#f7f7f7;">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 20px; background-color: #f7f7f7; font-family: Arial, sans-serif; }
  </style>
</head>
<body style="margin:0!important;padding:20px!important;background-color:#f7f7f7;">
  ${advertorialHtml}
</body>
</html>`

    return NextResponse.json({ html, ad })
  }
)
