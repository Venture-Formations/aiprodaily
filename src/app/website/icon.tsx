import { ImageResponse } from 'next/og'
import { supabaseAdmin } from '@/lib/supabase'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default async function Icon() {
  // Fetch logo URL from database
  const { data: logoSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'logo_url')
    .single()

  const logoUrl = logoSetting?.value || '/logo.png'

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
