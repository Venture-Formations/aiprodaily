import crypto from 'crypto'
import { supabaseAdmin } from './supabase'
import { STORAGE_PUBLIC_URL } from './config'
import { optimizeBuffer, optimizeFromUrl } from './tinify-service'

const BUCKET = 'img'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/** Short path prefixes inside the `img` bucket */
const PREFIX = {
  article: 'a',
  social: 's',
  businessHeader: 'bh',
  businessLogo: 'bl',
  cover: 'c',
  variant: 'v',
  static: 'st',
} as const

export class SupabaseImageStorage {
  /**
   * Download an image from a URL, optimize via Tinify, and upload to the
   * article images path. Returns the public URL or null on failure.
   */
  async uploadImage(imageUrl: string, _articleTitle?: string): Promise<string | null> {
    try {
      const optimized = await optimizeFromUrl(imageUrl, { preset: 'newsletter' })
      if (!optimized) return null

      if (optimized.length > MAX_FILE_SIZE) return null

      const imageHash = crypto.createHash('md5').update(imageUrl).digest('hex')
      const ext = getExtensionFromUrl(imageUrl)
      const fileName = `${imageHash}${ext}`
      const objectPath = `${PREFIX.article}/${fileName}`

      return this.uploadToStorage(objectPath, optimized, mimeFromExt(ext))
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadImage failed:', error)
      return null
    }
  }

  /**
   * Upload a pre-processed buffer (e.g. from Sharp) to the article images path.
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    _description?: string
  ): Promise<string | null> {
    try {
      if (buffer.length > MAX_FILE_SIZE) return null

      const optimized = await optimizeBuffer(buffer, { preset: 'newsletter' })
      const objectPath = `${PREFIX.article}/${fileName}`

      return this.uploadToStorage(objectPath, optimized, mimeFromExt(getExtFromFileName(fileName)))
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadBuffer failed:', error)
      return null
    }
  }

  /**
   * Upload a cropped image variant (e.g. 1200x675) to the variants path.
   */
  async uploadImageVariant(
    imageBuffer: Buffer,
    imageId: string,
    variant: string = '1200x675',
    _description?: string
  ): Promise<string | null> {
    try {
      if (imageBuffer.length > MAX_FILE_SIZE) return null

      const optimized = await optimizeBuffer(imageBuffer)
      const objectPath = `${PREFIX.variant}/${variant}/${imageId}.jpg`

      return this.uploadToStorage(objectPath, optimized, 'image/jpeg')
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadImageVariant failed:', error)
      return null
    }
  }

  /**
   * Upload a business header or logo image.
   */
  async uploadBusinessImage(
    buffer: Buffer,
    type: 'header' | 'logo' | 'website_header',
    publicationId: string
  ): Promise<string | null> {
    try {
      if (buffer.length > MAX_FILE_SIZE) return null

      const optimized = await optimizeBuffer(buffer, { preset: 'header' })
      const prefix = type === 'logo' ? PREFIX.businessLogo : PREFIX.businessHeader
      const timestamp = Date.now()
      const objectPath = `${prefix}/${publicationId}-${timestamp}.png`

      return this.uploadToStorage(objectPath, optimized, 'image/png')
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadBusinessImage failed:', error)
      return null
    }
  }

  /**
   * Upload a social media icon.
   */
  async uploadSocialIcon(buffer: Buffer, name: string): Promise<string | null> {
    try {
      const optimized = await optimizeBuffer(buffer, { preset: 'social-icon' })
      const objectPath = `${PREFIX.social}/${name}`

      return this.uploadToStorage(objectPath, optimized, 'image/png', true)
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadSocialIcon failed:', error)
      return null
    }
  }

  /**
   * Upload a static asset (background images, cover photos, etc.).
   */
  async uploadStaticAsset(buffer: Buffer, fileName: string, contentType: string): Promise<string | null> {
    try {
      const optimized = await optimizeBuffer(buffer)
      const objectPath = `${PREFIX.static}/${fileName}`

      return this.uploadToStorage(objectPath, optimized, contentType, true)
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadStaticAsset failed:', error)
      return null
    }
  }

  /**
   * Upload a cover image.
   */
  async uploadCoverImage(buffer: Buffer, fileName: string): Promise<string | null> {
    try {
      const optimized = await optimizeBuffer(buffer, { preset: 'newsletter' })
      const objectPath = `${PREFIX.cover}/${fileName}`

      return this.uploadToStorage(objectPath, optimized, mimeFromExt(getExtFromFileName(fileName)), true)
    } catch (error) {
      console.error('[SupabaseImageStorage] uploadCoverImage failed:', error)
      return null
    }
  }

  /** Get the public CDN URL for an image variant */
  getCdnUrl(imageId: string, variant: string = '1200x675'): string {
    return `${STORAGE_PUBLIC_URL}/${BUCKET}/${PREFIX.variant}/${variant}/${imageId}.jpg`
  }

  /** Get the public URL for any path in the img bucket */
  getPublicUrl(objectPath: string): string {
    return `${STORAGE_PUBLIC_URL}/${BUCKET}/${objectPath}`
  }

  /** Get the public URL for a social icon */
  getSocialIconUrl(name: string): string {
    return `${STORAGE_PUBLIC_URL}/${BUCKET}/${PREFIX.social}/${name}`
  }

  /** Check if a file already exists in storage */
  async exists(objectPath: string): Promise<boolean> {
    const pathParts = objectPath.split('/')
    const folder = pathParts.slice(0, -1).join('/')
    const fileName = pathParts[pathParts.length - 1]

    const { data } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 1 })

    return (data?.length ?? 0) > 0
  }

  /** Upload buffer to Supabase Storage and return the public URL */
  private async uploadToStorage(
    objectPath: string,
    buffer: Buffer,
    contentType: string,
    upsert: boolean = false
  ): Promise<string | null> {
    if (!upsert) {
      const alreadyExists = await this.exists(objectPath)
      if (alreadyExists) {
        return `${STORAGE_PUBLIC_URL}/${BUCKET}/${objectPath}`
      }
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert,
      })

    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
        return `${STORAGE_PUBLIC_URL}/${BUCKET}/${objectPath}`
      }
      console.error(`[SupabaseImageStorage] Upload failed for ${objectPath}:`, error.message)
      return null
    }

    return `${STORAGE_PUBLIC_URL}/${BUCKET}/${objectPath}`
  }
}

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.includes('.png')) return '.png'
    if (pathname.includes('.gif')) return '.gif'
    if (pathname.includes('.webp')) return '.webp'
    if (pathname.includes('.svg')) return '.svg'
    return '.jpg'
  } catch {
    return '.jpg'
  }
}

function getExtFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot) : '.jpg'
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }
  return map[ext.toLowerCase()] || 'image/jpeg'
}
