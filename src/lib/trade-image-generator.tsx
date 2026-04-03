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

  // Determine transaction color
  const isPurchase = transaction.toLowerCase().includes('purchase')
  const barColor = isPurchase ? '#2ecc71' : '#e74c3c'
  const transactionLabel = isPurchase ? 'Purchase' : 'Sale'

  // Build chamber/state subtitle
  const subtitle = [chamber, state].filter(Boolean).join(' · ')

  try {
    const response = new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '60px',
          }}
        >
          {/* Member photo */}
          <div
            style={{
              width: '320px',
              height: '400px',
              borderRadius: '12px',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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

          {/* Info bars */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '50px',
              flex: 1,
              gap: '20px',
            }}
          >
            {/* Name bar */}
            <div
              style={{
                background: barColor,
                borderRadius: '6px',
                padding: '24px 32px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '42px',
                  fontWeight: 700,
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {memberName}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: '22px',
                    color: 'rgba(255,255,255,0.85)',
                    marginTop: '4px',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>

            {/* Transaction bar */}
            <div
              style={{
                background: barColor,
                borderRadius: '6px',
                padding: '20px 32px',
                display: 'flex',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {transactionLabel}
              </div>
            </div>

            {/* Company bar */}
            <div
              style={{
                background: barColor,
                borderRadius: '6px',
                padding: '20px 32px',
                display: 'flex',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {companyName}
              </div>
            </div>
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
