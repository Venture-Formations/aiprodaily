const TINIFY_API_URL = 'https://api.tinify.com'

type ResizeMethod = 'scale' | 'fit' | 'cover'

interface ResizeOptions {
  method: ResizeMethod
  width?: number
  height?: number
}

interface OptimizeOptions {
  resize?: ResizeOptions
}

const RESIZE_PRESETS: Record<string, ResizeOptions> = {
  newsletter: { method: 'fit', width: 770 },
  thumbnail: { method: 'fit', width: 400 },
  header: { method: 'fit', width: 770 },
  'social-icon': { method: 'fit', width: 48, height: 48 },
}

function getAuthHeader(): string {
  const apiKey = process.env.TINIFY_API_KEY
  if (!apiKey) return ''
  return 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
}

function isEnabled(): boolean {
  return !!process.env.TINIFY_API_KEY
}

/**
 * Compress an image buffer via Tinify, optionally resize.
 * Returns the optimized buffer, or the original buffer if Tinify is unavailable.
 */
export async function optimizeBuffer(
  buffer: Buffer,
  options?: OptimizeOptions & { preset?: string }
): Promise<Buffer> {
  if (!isEnabled()) return buffer

  try {
    const auth = getAuthHeader()

    const shrinkRes = await fetch(`${TINIFY_API_URL}/shrink`, {
      method: 'POST',
      headers: { Authorization: auth },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(15_000),
    })

    if (!shrinkRes.ok) {
      console.error(`[Tinify] Shrink failed: ${shrinkRes.status} ${shrinkRes.statusText}`)
      return buffer
    }

    const outputUrl = shrinkRes.headers.get('location')
    if (!outputUrl) {
      console.error('[Tinify] No Location header in shrink response')
      return buffer
    }

    const resize = options?.preset
      ? RESIZE_PRESETS[options.preset]
      : options?.resize

    if (resize) {
      const resizeRes = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resize }),
        signal: AbortSignal.timeout(15_000),
      })

      if (!resizeRes.ok) {
        console.error(`[Tinify] Resize failed: ${resizeRes.status}`)
        return buffer
      }

      return Buffer.from(await resizeRes.arrayBuffer())
    }

    const downloadRes = await fetch(outputUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(15_000),
    })

    if (!downloadRes.ok) {
      console.error(`[Tinify] Download failed: ${downloadRes.status}`)
      return buffer
    }

    return Buffer.from(await downloadRes.arrayBuffer())
  } catch (error) {
    console.error('[Tinify] Optimization failed, returning original:', error)
    return buffer
  }
}

/**
 * Have Tinify fetch and compress an image from a URL.
 * Returns the optimized buffer, or null on failure.
 */
export async function optimizeFromUrl(
  imageUrl: string,
  options?: OptimizeOptions & { preset?: string }
): Promise<Buffer | null> {
  if (!isEnabled()) {
    try {
      const res = await fetch(imageUrl, {
        headers: { 'User-Agent': 'AI-Pro-Daily/1.0', Accept: 'image/*' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  try {
    const auth = getAuthHeader()

    const shrinkRes = await fetch(`${TINIFY_API_URL}/shrink`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: { url: imageUrl } }),
    })

    if (!shrinkRes.ok) {
      console.error(`[Tinify] URL shrink failed: ${shrinkRes.status}`)
      return null
    }

    const outputUrl = shrinkRes.headers.get('location')
    if (!outputUrl) return null

    const resize = options?.preset
      ? RESIZE_PRESETS[options.preset]
      : options?.resize

    if (resize) {
      const resizeRes = await fetch(outputUrl, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resize }),
      })

      if (!resizeRes.ok) return null
      return Buffer.from(await resizeRes.arrayBuffer())
    }

    const downloadRes = await fetch(outputUrl, {
      headers: { Authorization: auth },
    })

    if (!downloadRes.ok) return null
    return Buffer.from(await downloadRes.arrayBuffer())
  } catch (error) {
    console.error('[Tinify] URL optimization failed:', error)
    return null
  }
}
