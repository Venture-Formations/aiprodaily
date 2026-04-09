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
    ticker: trade.ticker,
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
  ticker: string
  photoDataUrl: string
}

/**
 * Pick a font size that will fit the member name on a single line.
 * Available width is ~440px at the default 48px font size.
 * Scales down in steps based on character count.
 */
function getMemberNameFontSize(name: string): number {
  const len = name.length
  if (len <= 14) return 48
  if (len <= 17) return 42
  if (len <= 20) return 38
  if (len <= 23) return 34
  if (len <= 26) return 30
  if (len <= 30) return 26
  return 22
}

async function renderTradeCard(params: CardParams): Promise<Buffer | null> {
  const { memberName, chamber, state, transaction, companyName, ticker, photoDataUrl } = params

  const memberNameFontSize = getMemberNameFontSize(memberName)
  const isPurchase = transaction.toLowerCase().includes('purchase')
  const tickerColor = isPurchase ? '#00ff88' : '#ff4444'
  const buttonBg = isPurchase
    ? 'linear-gradient(180deg, #008000 0%, #004d00 100%)'
    : 'linear-gradient(180deg, #cc0000 0%, #8b0000 100%)'
  const buttonLabel = isPurchase ? 'BUY' : 'SELL'

  const subtitle = [chamber, state].filter(Boolean).join(' · ')

  try {
    // Load Inter Black (900) for thick, bold letters
    let fontData: ArrayBuffer | null = null
    try {
      const fontRes = await fetch(
        'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf',
        { signal: AbortSignal.timeout(5_000) }
      )
      if (fontRes.ok) {
        fontData = await fontRes.arrayBuffer()
      } else {
        console.error(`[trade-image] Font fetch failed: HTTP ${fontRes.status}`)
      }
    } catch (fontErr) {
      console.error('[trade-image] Font fetch error:', fontErr)
    }

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a1a',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Pill container */}
          <div
            style={{
              width: '1080px',
              height: '280px',
              borderRadius: '140px',
              background: 'linear-gradient(135deg, #1a1a4e 0%, #2d1b69 50%, #1a1a4e 100%)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              boxShadow: '0 0 15px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.2), 0 0 60px rgba(0,212,255,0.1), inset 0 0 30px rgba(0,212,255,0.05)',
              border: '2px solid rgba(0,212,255,0.3)',
              padding: '0 60px 0 0',
            }}
          >
            {/* Photo ring — outer glow */}
            <div
              style={{
                width: '240px',
                height: '240px',
                borderRadius: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '20px',
                flexShrink: 0,
                background: 'linear-gradient(135deg, #00d4ff 0%, #6366f1 50%, #00d4ff 100%)',
                boxShadow: '0 0 10px rgba(0,212,255,0.5), 0 0 20px rgba(0,212,255,0.3)',
              }}
            >
              {/* Photo ring — inner border */}
              <div
                style={{
                  width: '228px',
                  height: '228px',
                  borderRadius: '114px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#1a1a4e',
                }}
              >
                {/* Photo */}
                <div
                  style={{
                    width: '216px',
                    height: '216px',
                    borderRadius: '108px',
                    overflow: 'hidden',
                    display: 'flex',
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
            </div>

            {/* Center content — Name + Subtitle */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginLeft: '40px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: `${memberNameFontSize}px`,
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '1px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {memberName}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 600,
                    color: '#00d4ff',
                    marginTop: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    textShadow: '0 0 10px rgba(0,212,255,0.3)',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>

            {/* Right side — Ticker + Button */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                marginLeft: '20px',
                gap: '12px',
              }}
            >
              {/* Ticker label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  }}
                >
                  STOCK:
                </span>
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 900,
                    color: tickerColor,
                    letterSpacing: '1px',
                    textShadow: `0 0 8px ${tickerColor}40`,
                  }}
                >
                  {ticker}
                </span>
              </div>

              {/* Buy/Sell button — outer glow ring */}
              <div
                style={{
                  background: isPurchase
                    ? 'linear-gradient(135deg, #00ff88 0%, #00cc66 50%, #00ff88 100%)'
                    : 'linear-gradient(135deg, #ff4444 0%, #cc0000 50%, #ff4444 100%)',
                  borderRadius: '14px',
                  padding: '3px',
                  display: 'flex',
                  boxShadow: isPurchase
                    ? '0 0 16px rgba(0,255,136,0.5), 0 0 32px rgba(0,255,136,0.2), 0 4px 12px rgba(0,0,0,0.3)'
                    : '0 0 16px rgba(255,68,68,0.5), 0 0 32px rgba(255,68,68,0.2), 0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                {/* Inner button */}
                <div
                  style={{
                    background: buttonBg,
                    borderRadius: '11px',
                    padding: '10px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top highlight reflection */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
                      borderRadius: '11px 11px 0 0',
                      display: 'flex',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '38px',
                      fontWeight: 900,
                      color: 'white',
                      letterSpacing: '4px',
                      textShadow: isPurchase
                        ? '0 0 10px rgba(0,255,136,0.4), 0 1px 4px rgba(0,0,0,0.3)'
                        : '0 0 10px rgba(255,68,68,0.4), 0 1px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {buttonLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        ...(fontData ? {
          fonts: [
            {
              name: 'Inter',
              data: fontData,
              weight: 900 as const,
              style: 'normal' as const,
            },
          ],
        } : {}),
      }
    )

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[trade-image] Failed to render trade card:', error instanceof Error ? error.stack : error)
    return null
  }
}
