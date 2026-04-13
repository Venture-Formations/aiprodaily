/**
 * Generates trade card images for congressional stock trades.
 * Uses @vercel/og (Satori) to render JSX to PNG, then compresses via Tinify.
 *
 * Layout: Member photo on left, 3 bars on right (name, transaction, company).
 * Colors: Dark gray gradient bg, green for Purchase, red for Sale.
 * Dimensions: 1200x630.
 */
import { ImageResponse } from '@vercel/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { resolveBioguideId, fetchMemberPhoto, formatDisplayName } from './congress-photos'
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

// Module-level font cache — the Inter Black font ships with the repo under
// public/fonts/Inter-Black.ttf and is loaded once per process. This eliminates
// the Google Fonts dependency entirely.
let cachedFontData: ArrayBuffer | null = null
let fontLoadPromise: Promise<ArrayBuffer | null> | null = null

async function getInterBlackFont(): Promise<ArrayBuffer | null> {
  if (cachedFontData) return cachedFontData
  if (fontLoadPromise) return fontLoadPromise

  fontLoadPromise = (async () => {
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Inter-Black.ttf')
      const buffer = await readFile(fontPath)
      cachedFontData = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer
      return cachedFontData
    } catch (err) {
      console.error(
        '[trade-image] Failed to load bundled font:',
        err instanceof Error ? err.message : 'Unknown'
      )
      return null
    }
  })()

  const result = await fontLoadPromise
  fontLoadPromise = null
  return result
}

/**
 * Generate a trade card image and upload to Supabase storage.
 * Returns the public URL, or null if member photo is unavailable.
 *
 * Pass `force: true` to bypass the "already exists" short-circuit and
 * overwrite the stored PNG (upsert). Useful for design iteration.
 */
export async function generateAndUploadTradeImage(
  trade: TradeInput,
  options: { force?: boolean } = {}
): Promise<string | null> {
  if (!trade.name) {
    console.log(`[trade-image] Skipping trade ${trade.id}: no member name`)
    return null
  }

  // Check if image already exists in storage (unless forced)
  const objectPath = `st/t/${trade.id}.png`
  if (!options.force) {
    const exists = await imageStorage.exists(objectPath)
    if (exists) {
      return imageStorage.getPublicUrl(objectPath)
    }
  }

  // Resolve bioguide ID (state disambiguates same-name members)
  const bioguideId = await resolveBioguideId(trade.name, trade.chamber, trade.state)
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
    memberName: formatDisplayName(trade.name),
    chamber: trade.chamber || '',
    state: trade.state || '',
    transaction: trade.transaction || 'Purchase',
    ticker: trade.ticker,
    photoDataUrl: photoBase64,
  })

  if (!imageBuffer) return null

  // Trade cards are already small (1200×320 Satori PNG ~30-80KB).
  // Skip Tinify — the round-trip + quota spend isn't worth it.
  const imageUrl = await imageStorage.uploadStaticAsset(
    imageBuffer,
    `t/${trade.id}.png`,
    'image/png',
    { skipOptimize: true }
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
  ticker: string
  photoDataUrl: string
}

/**
 * Split a display name into first / last for two-line rendering.
 *
 * Rules:
 *  - Skip leading title tokens (Dr., Rep., Sen., etc.).
 *  - Middle initials ("A", "A.", "B.") stick with the first name line,
 *    so "John A. Smith" renders as "John A." / "Smith".
 *  - Multi-word last names stay together: "John Van Duyne" → "Van Duyne",
 *    "Maria de la Cruz" → "de la Cruz".
 */
function splitMemberName(fullName: string): { first: string; last: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { first: '', last: '' }
  if (tokens.length === 1) return { first: '', last: tokens[0] }

  const titleTokens = new Set(['Dr', 'Mr', 'Ms', 'Mrs', 'Rep', 'Sen', 'Hon'])
  let startIdx = 0
  const firstTokenBare = tokens[0].replace(/\./g, '')
  if (tokens[0].endsWith('.') || titleTokens.has(firstTokenBare)) {
    startIdx = 1
  }

  const remaining = tokens.slice(startIdx)
  if (remaining.length === 0) return { first: '', last: tokens[0] }
  if (remaining.length === 1) return { first: '', last: remaining[0] }

  // Absorb middle initials into the first-name line.
  const initialPattern = /^[A-Za-z]\.?$/
  const firstParts: string[] = [remaining[0]]
  let splitAt = 1
  while (splitAt < remaining.length - 1 && initialPattern.test(remaining[splitAt])) {
    firstParts.push(remaining[splitAt])
    splitAt++
  }

  return {
    first: firstParts.join(' '),
    last: remaining.slice(splitAt).join(' '),
  }
}

function getFirstNameFontSize(name: string): number {
  const len = name.length
  if (len <= 10) return 60
  if (len <= 13) return 52
  return 44
}

function getLastNameFontSize(name: string): number {
  const len = name.length
  if (len <= 10) return 84
  if (len <= 13) return 72
  if (len <= 16) return 60
  return 50
}

function getTickerFontSize(ticker: string): number {
  const len = ticker.length
  if (len <= 4) return 56
  if (len === 5) return 48
  return 40
}

async function renderTradeCard(params: CardParams): Promise<Buffer | null> {
  const { memberName, chamber, state, transaction, ticker, photoDataUrl } = params

  const { first: firstName, last: lastName } = splitMemberName(memberName)
  const firstNameFontSize = getFirstNameFontSize(firstName)
  const lastNameFontSize = getLastNameFontSize(lastName)
  const tickerFontSize = getTickerFontSize(ticker)
  const isPurchase = transaction.toLowerCase().includes('purchase')
  const tickerColor = isPurchase ? '#00ff88' : '#ff4444'
  const buttonBg = isPurchase
    ? 'linear-gradient(180deg, #008000 0%, #004d00 100%)'
    : 'linear-gradient(180deg, #cc0000 0%, #8b0000 100%)'
  const buttonLabel = isPurchase ? 'BUY' : 'SELL'

  const subtitle = [chamber, state].filter(Boolean).join(' · ')

  try {
    // Load Inter Black (900) — cached at module level so we only hit Google
    // Fonts once per process, not once per image generation.
    const fontData = await getInterBlackFont()

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* Pill container */}
          <div
            style={{
              width: '1160px',
              height: '280px',
              borderRadius: '140px',
              background: 'linear-gradient(135deg, #1a1a4e 0%, #2d1b69 50%, #1a1a4e 100%)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              boxShadow: '0 0 15px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.2), 0 0 60px rgba(0,212,255,0.1), inset 0 0 30px rgba(0,212,255,0.05)',
              border: '2px solid rgba(0,212,255,0.3)',
              padding: '0 50px 0 0',
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

            {/* Center content — First name, Last name, Subtitle */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginLeft: '40px',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              {firstName && (
                <div
                  style={{
                    fontSize: `${firstNameFontSize}px`,
                    fontWeight: 900,
                    color: 'white',
                    lineHeight: 1,
                    letterSpacing: '1px',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {firstName}
                </div>
              )}
              <div
                style={{
                  fontSize: `${lastNameFontSize}px`,
                  fontWeight: 900,
                  color: 'white',
                  lineHeight: 1,
                  marginTop: firstName ? '6px' : '0',
                  letterSpacing: '1px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {lastName}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#00d4ff',
                    marginTop: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
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
                gap: '14px',
              }}
            >
              {/* Stock label + ticker stacked */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  STOCK:
                </div>
                <div
                  style={{
                    fontSize: `${tickerFontSize}px`,
                    fontWeight: 900,
                    color: tickerColor,
                    letterSpacing: '2px',
                    lineHeight: 1,
                    marginTop: '6px',
                    textShadow: `0 0 10px ${tickerColor}66`,
                  }}
                >
                  {ticker}
                </div>
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
                    padding: '8px 44px',
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
                      fontSize: '44px',
                      fontWeight: 900,
                      color: 'white',
                      letterSpacing: '5px',
                      lineHeight: 1,
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
        height: 320,
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
