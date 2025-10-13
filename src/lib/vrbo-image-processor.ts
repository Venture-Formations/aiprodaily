import { GitHubImageStorage } from './github-storage'
import crypto from 'crypto'
import sharp from 'sharp'

interface ImageProcessingResult {
  success: boolean
  adjusted_image_url?: string
  error?: string
}

/**
 * Process a VRBO listing image by downloading, resizing to 575x325, and uploading to GitHub
 * This creates properly sized images for newsletter use and hosts them reliably
 */
export async function processVrboImage(
  originalImageUrl: string,
  listingTitle: string,
  listingId?: string
): Promise<ImageProcessingResult> {
  try {
    console.log('Processing VRBO image:', originalImageUrl)

    if (!originalImageUrl) {
      return { success: false, error: 'No image URL provided' }
    }

    // Download the original image
    console.log('Downloading image from:', originalImageUrl)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

    const response = await fetch(originalImageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StCloudScoop-Newsletter/1.0',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`Failed to download VRBO image: HTTP ${response.status} ${response.statusText}`)
      return {
        success: false,
        error: `Failed to download image: HTTP ${response.status}`
      }
    }

    // Get image buffer
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    console.log(`Downloaded image, size: ${imageBuffer.length} bytes`)

    // Resize image to 575x325 (VRBO newsletter dimensions)
    console.log('Resizing image to 575x325...')
    const resizedBuffer = await sharp(imageBuffer)
      .resize(575, 325, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer()

    console.log(`Resized image, new size: ${resizedBuffer.length} bytes`)

    // Generate filename with hash
    const hash = crypto.createHash('sha1').update(originalImageUrl).digest('hex').slice(0, 16)
    const filename = `vrbo-${hash}.jpg`

    // Upload to GitHub
    const githubStorage = new GitHubImageStorage()
    const githubUrl = await githubStorage.uploadBuffer(resizedBuffer, filename, `VRBO: ${listingTitle}`)

    if (githubUrl) {
      console.log(`VRBO image processed and uploaded to GitHub: ${githubUrl}`)
      return {
        success: true,
        adjusted_image_url: githubUrl
      }
    } else {
      console.error('VRBO image upload failed')
      return {
        success: false,
        error: 'Failed to upload processed image to GitHub'
      }
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`VRBO image download timeout for: ${originalImageUrl}`)
      return {
        success: false,
        error: 'Download timeout (20 seconds)'
      }
    } else {
      console.error(`Error processing VRBO image:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Get appropriate file extension from image URL
 */
function getImageExtension(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname.toLowerCase()

    if (pathname.includes('.jpg') || pathname.includes('.jpeg')) return '.jpg'
    if (pathname.includes('.png')) return '.png'
    if (pathname.includes('.gif')) return '.gif'
    if (pathname.includes('.webp')) return '.webp'
    if (pathname.includes('.svg')) return '.svg'

    // Default to .jpg if no extension found
    return '.jpg'
  } catch {
    return '.jpg'
  }
}

/**
 * Batch process multiple images for CSV uploads
 */
export async function batchProcessVrboImages(
  listings: Array<{ id: string; main_image_url: string | null }>
): Promise<{ processed: number; errors: string[] }> {
  const results = {
    processed: 0,
    errors: [] as string[]
  }

  for (const listing of listings) {
    if (!listing.main_image_url) continue

    try {
      const result = await processVrboImage(listing.main_image_url, listing.id)
      if (result.success) {
        results.processed++
      } else {
        results.errors.push(`${listing.id}: ${result.error}`)
      }
    } catch (error) {
      results.errors.push(`${listing.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

/**
 * Trigger GitHub Action workflow for image processing
 * This would use GitHub's REST API to trigger the workflow
 */
export async function triggerImageProcessingWorkflow(): Promise<boolean> {
  try {
    // This would trigger the GitHub Action workflow that runs build-images.js
    // For now, we'll just log that it would be triggered
    console.log('Would trigger GitHub Action workflow for VRBO image processing')

    // In actual implementation:
    // const response = await fetch('https://api.github.com/repos/VFDavid/STCScoop/actions/workflows/build.yml/dispatches', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    //     'Accept': 'application/vnd.github.v3+json',
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     ref: 'Vrbo',
    //     inputs: {}
    //   })
    // })

    return true
  } catch (error) {
    console.error('Error triggering image processing workflow:', error)
    return false
  }
}