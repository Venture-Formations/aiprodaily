import { ImageResponse } from 'next/og'
import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSetting } from '@/lib/publication-settings'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default async function Icon() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch logo URL from publication_settings
  const logoUrl = await getPublicationSetting(publicationId, 'logo_url') || '/logo.png'

  // Fetch the image
  try {
    const imageResponse = await fetch(logoUrl)
    const imageBuffer = await imageResponse.arrayBuffer()

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    })
  } catch (error) {
    // Fallback to a simple colored square if logo fetch fails
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 24,
            background: '#1c293d',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          AI
        </div>
      ),
      {
        ...size,
      }
    )
  }
}
