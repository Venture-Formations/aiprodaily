import { Octokit } from '@octokit/rest'
import crypto from 'crypto'

export class GitHubImageStorage {
  private octokit: Octokit | null
  private owner: string
  private repo: string
  private enabled: boolean

  constructor() {
    // Check if GitHub storage is configured
    this.enabled = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)

    if (!this.enabled) {
      // GitHub storage disabled
      this.octokit = null
      this.owner = ''
      this.repo = ''
      return
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    this.owner = process.env.GITHUB_OWNER!
    this.repo = process.env.GITHUB_REPO!
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async uploadImage(imageUrl: string, articleTitle: string): Promise<string | null> {
    if (!this.enabled || !this.octokit) {
      // GitHub storage not enabled
      return null
    }

    try {
      // Downloading image silently

      // Download image with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      let response
      try {
        response = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'AI-Pro-Daily/1.0',
            'Accept': 'image/*',
            'Cache-Control': 'no-cache'
          }
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        return null
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        return null
      }

      // Check content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        return null
      }

      // Get image data
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Check file size (limit to 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return null
      }

      // Generate hash of the image URL for deduplication
      const imageHash = crypto.createHash('md5').update(imageUrl).digest('hex')
      const fileExtension = this.getImageExtension(imageUrl)
      const fileName = `${imageHash}${fileExtension}`
      const filePath = `public/images/newsletter/${fileName}`

      // Check if image already exists in repository
      try {
        const { data: existingFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
        })

        if (existingFile && 'download_url' in existingFile && existingFile.download_url) {
          return existingFile.download_url
        }
      } catch (error: any) {
        // File doesn't exist, which is fine - we'll create it
        if (error.status !== 404) {
          // Error checking file
          return null
        }
      }

      // Convert buffer to base64 for GitHub API
      const content = buffer.toString('base64')

      // Upload to GitHub
      const uploadResponse = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: `Add newsletter image for article: ${articleTitle}`,
        content: content,
      })

      if (uploadResponse.data.content?.download_url) {
        return uploadResponse.data.content.download_url
      } else {
        // No download URL
        return null
      }

    } catch (error) {
      // Silently fail - GitHub upload errors are expected when images are unavailable
      return null
    }
  }

  private getImageExtension(url: string): string {
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

  async listImages(): Promise<string[]> {
    if (!this.enabled || !this.octokit) {
      return []
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'public/images/newsletter',
      })

      if (Array.isArray(data)) {
        return data
          .filter(file => file.type === 'file')
          .map(file => file.download_url)
          .filter((url): url is string => url !== null)
      }

      return []
    } catch (error) {
      console.error('Error listing GitHub images:', error)
      return []
    }
  }

  /**
   * Upload a buffer directly to GitHub with a custom filename
   * Used for VRBO images that have already been processed/resized
   */
  async uploadBuffer(buffer: Buffer, fileName: string, description: string): Promise<string | null> {
    if (!this.enabled || !this.octokit) {
      console.warn('GitHub storage not enabled, skipping buffer upload')
      return null
    }

    try {
      console.log(`Uploading buffer to GitHub: ${fileName}`)

      // Check file size (limit to 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        console.error(`Buffer too large: ${buffer.length} bytes (max 5MB)`)
        return null
      }

      const filePath = `public/images/newsletter/${fileName}`

      // Check if file already exists in repository
      try {
        const { data: existingFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
        })

        if (existingFile && 'download_url' in existingFile && existingFile.download_url) {
          console.log(`File already exists in GitHub: ${fileName}`)
          return existingFile.download_url
        }
      } catch (error: any) {
        // File doesn't exist, which is fine - we'll create it
        if (error.status !== 404) {
          // Error checking file
          return null
        }
      }

      // Convert buffer to base64 for GitHub API
      const content = buffer.toString('base64')

      // Upload to GitHub
      const uploadResponse = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: `Add processed image: ${description}`,
        content: content,
      })

      if (uploadResponse.data.content?.download_url) {
        console.log(`Buffer uploaded to GitHub: ${uploadResponse.data.content.download_url}`)
        return uploadResponse.data.content.download_url
      } else {
        // No download URL
        return null
      }

    } catch (error) {
      console.error(`Error uploading buffer to GitHub:`, error)
      return null
    }
  }

  /**
   * Upload a 16:9 cropped variant of an image to the library folder
   */
  async uploadImageVariant(
    imageBuffer: Buffer,
    imageId: string,
    variant: string = '1200x675',
    description: string = 'Library image variant'
  ): Promise<string | null> {
    if (!this.enabled || !this.octokit) {
      console.warn('GitHub storage not enabled, skipping image variant upload')
      return null
    }

    try {
      console.log(`Uploading ${variant} variant for image: ${imageId}`)

      // Check file size (limit to 5MB)
      if (imageBuffer.length > 5 * 1024 * 1024) {
        console.error(`Image variant too large: ${imageBuffer.length} bytes (max 5MB)`)
        return null
      }

      const fileName = `${imageId}.jpg`
      const filePath = `public/images/library/${variant}/${fileName}`

      // Check if variant already exists
      try {
        const { data: existingFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
        })

        if (existingFile && 'download_url' in existingFile && existingFile.download_url) {
          console.log(`Image variant already exists: ${fileName}`)
          return existingFile.download_url
        }
      } catch (error: any) {
        // File doesn't exist, which is fine - we'll create it
        if (error.status !== 404) {
          console.error('Error checking existing variant:', error)
          return null
        }
      }

      // Convert buffer to base64 for GitHub API
      const content = imageBuffer.toString('base64')

      // Upload to GitHub
      const uploadResponse = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: `Add ${variant} variant for image ${imageId}: ${description}`,
        content: content,
      })

      if (uploadResponse.data.content?.download_url) {
        console.log(`Image variant uploaded to GitHub: ${uploadResponse.data.content.download_url}`)
        return uploadResponse.data.content.download_url
      } else {
        console.error('Variant upload successful but no download URL returned')
        return null
      }

    } catch (error) {
      console.error(`Error uploading image variant to GitHub:`, error)
      return null
    }
  }

  /**
   * Get CDN URL for an image variant (uses jsDelivr CDN)
   */
  getCdnUrl(imageId: string, variant: string = '1200x675'): string {
    return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@main/public/images/library/${variant}/${imageId}.jpg`
  }

  /**
   * List all image variants in the library
   */
  async listImageVariants(variant: string = '1200x675'): Promise<Array<{id: string, url: string}>> {
    if (!this.enabled || !this.octokit) {
      return []
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: `public/images/library/${variant}`,
      })

      if (Array.isArray(data)) {
        return data
          .filter(file => file.type === 'file' && file.name?.endsWith('.jpg'))
          .map(file => ({
            id: file.name!.replace('.jpg', ''),
            url: file.download_url!
          }))
          .filter(item => item.url)
      }

      return []
    } catch (error) {
      console.error(`Error listing image variants for ${variant}:`, error)
      return []
    }
  }

  /**
   * Delete an image variant from GitHub
   */
  async deleteImageVariant(imageId: string, variant: string = '1200x675'): Promise<boolean> {
    if (!this.enabled || !this.octokit) {
      return false
    }

    try {
      const fileName = `${imageId}.jpg`
      const filePath = `public/images/library/${variant}/${fileName}`

      // Get file info first to get the SHA
      const { data: fileInfo } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
      })

      if ('sha' in fileInfo) {
        await this.octokit.repos.deleteFile({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
          message: `Delete ${variant} variant for image ${imageId}`,
          sha: fileInfo.sha
        })

        console.log(`Deleted image variant: ${fileName}`)
        return true
      }

      return false
    } catch (error) {
      console.error(`Error deleting image variant ${imageId}:`, error)
      return false
    }
  }
}