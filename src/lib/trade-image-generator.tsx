/**
 * Generates trade card images for congressional stock trades.
 * Uses @vercel/og (Satori) to render JSX to PNG, then compresses via Tinify.
 *
 * Layout: Member photo on left, 3 bars on right (name, transaction, company).
 * Colors: Dark gray gradient bg, green for Purchase, red for Sale.
 * Dimensions: 1200x630.
 */
import { ImageResponse } from '@vercel/og'
import { resolveBioguideId, fetchMemberPhoto } from './congress-photos'
import { SupabaseImageStorage } from './supabase-image-storage'
import { supabaseAdmin } from './supabase'

interface TradeInput {
  id: string
  name: string | null
  chamber: string | null
  state: string | null
  transaction: string | null
  company: string | null
  ticker: string
}

const imageStorage = new SupabaseImageStorage()

/**
 * Generate a trade card image and upload to Supabase storage.
 * Returns the public URL, or null if member photo is unavailable.
 */
export async function generateAndUploadTradeImage(trade: TradeInput): Promise<string | null> {
  if (!trade.name) {
    console.log(`[trade-image] Skipping trade ${trade.id}: no member name`)
    return null
  }

  // Check if image already exists in storage
  const objectPath = `st/t/${trade.id}.png`
  const exists = await imageStorage.exists(objectPath)
  if (exists) {
    return imageStorage.getPublicUrl(objectPath)
  }

  // Resolve bioguide ID
  const bioguideId = await resolveBioguideId(trade.name, trade.chamber)
  if (!bioguideId) {
    console.log(`[trade-image] Skipping trade ${trade.id}: no bioguide ID for "${trade.name}"`)
    return null
  }

  // Fetch member photo
  const photoBuffer = await fetchMemberPhoto(bioguideId)
  if (!photoBuffer) {
    console.log(`[trade-image] Skipping trade ${trade.id}: no photo for ${bioguideId}`)
    return null
  }

  // Convert photo to base64 data URL for embedding in JSX
  const photoBase64 = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`

  // Generate the trade card image
  const imageBuffer = await renderTradeCard({
    memberName: trade.name,
    chamber: trade.chamber || '',
    state: trade.state || '',
    transaction: trade.transaction || 'Purchase',
    companyName: trade.company || trade.ticker,
    photoDataUrl: photoBase64,
  })

  if (!imageBuffer) return null

  // Upload with Tinify compression
  const imageUrl = await imageStorage.uploadStaticAsset(
    imageBuffer,
    `t/${trade.id}.png`,
    'image/png'
  )

  if (imageUrl) {
    // Update trade record with image URL
    await supabaseAdmin
      .from('congress_trades')
      .update({ image_url: imageUrl })
      .eq('id', trade.id)
  }

  return imageUrl
}

interface CardParams {
  memberName: string
  chamber: string
  state: string
  transaction: string
  companyName: string
  photoDataUrl: string
}

async function renderTradeCard(params: CardParams): Promise<Buffer | null> {
  const { memberName, chamber, state, transaction, companyName, photoDataUrl } = params

  // Determine transaction colors
  const isPurchase = transaction.toLowerCase().includes('purchase')
  const barGradient = isPurchase
    ? 'linear-gradient(135deg, #1a8a4a 0%, #27ae60 50%, #2ecc71 100%)'
    : 'linear-gradient(135deg, #7a1a1a 0%, #a93226 50%, #c0392b 100%)'
  const barShadow = '0 4px 20px rgba(0,0,0,0.5)'
  const transactionLabel = isPurchase ? 'Purchase' : 'Sale'

  // Build chamber/state subtitle
  const subtitle = [chamber, state].filter(Boolean).join(' · ')

  // Photo dimensions and positioning
  const photoWidth = 360
  const photoHeight = 470
  const photoLeft = 50
  const photoTop = 80

  // Bar positioning — bars start from left edge, tucked behind the photo
  const barLeft = 0
  const barTextLeft = photoLeft + photoWidth + 30 // text starts after the photo

  try {
    const response = new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            position: 'relative',
            background: 'linear-gradient(145deg, #d4e6f1 0%, #85c1e9 30%, #5dade2 60%, #3498db 100%)',
            overflow: 'hidden',
          }}
        >
          {/* Subtle pattern overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)',
              display: 'flex',
            }}
          />

          {/* Name bar — full width, tucked behind photo */}
          <div
            style={{
              position: 'absolute',
              left: `${barLeft}px`,
              top: `${photoTop + 20}px`,
              right: '50px',
              height: '120px',
              background: barGradient,
              borderRadius: '0 8px 8px 0',
              boxShadow: barShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingLeft: `${barTextLeft}px`,
              paddingRight: '32px',
            }}
          >
            <div
              style={{
                fontSize: '44px',
                fontWeight: 700,
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {memberName}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: '22px',
                  color: 'rgba(255,255,255,0.9)',
                  marginTop: '2px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {/* Transaction bar */}
          <div
            style={{
              position: 'absolute',
              left: `${barLeft}px`,
              top: `${photoTop + 160}px`,
              right: '50px',
              height: '80px',
              background: barGradient,
              borderRadius: '0 8px 8px 0',
              boxShadow: barShadow,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `${barTextLeft}px`,
              paddingRight: '32px',
            }}
          >
            <div
              style={{
                fontSize: '34px',
                fontWeight: 700,
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {transactionLabel}
            </div>
          </div>

          {/* Company bar */}
          <div
            style={{
              position: 'absolute',
              left: `${barLeft}px`,
              top: `${photoTop + 260}px`,
              right: '50px',
              height: '80px',
              background: barGradient,
              borderRadius: '0 8px 8px 0',
              boxShadow: barShadow,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `${barTextLeft}px`,
              paddingRight: '32px',
            }}
          >
            <div
              style={{
                fontSize: '34px',
                fontWeight: 700,
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {companyName}
            </div>
          </div>

          {/* Member photo — overlaps bars, sits on top */}
          <div
            style={{
              position: 'absolute',
              left: `${photoLeft}px`,
              top: `${photoTop}px`,
              width: `${photoWidth}px`,
              height: `${photoHeight}px`,
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.3)',
            }}
          >
            <img
              src={photoDataUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[trade-image] Failed to render trade card:', error)
    return null
  }
}
