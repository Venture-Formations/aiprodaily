import { ImageAnnotatorClient } from '@google-cloud/vision'
import { GoogleAuth } from 'google-auth-library'

interface VisionSearchResult {
  source_url: string
  source_name: string
  title?: string
  creator?: string
  license_info?: string
  similarity_score?: number
  thumbnail_url?: string
}

export class GoogleVisionService {
  private visionClient: ImageAnnotatorClient
  private auth: GoogleAuth

  /**
   * Safely parse Google Cloud credentials JSON, handling base64 and escaped formats
   */
  private parseCredentialsJson(credentialsString: string) {
    try {
      // Strategy 1: Check if it's base64 encoded (preferred for deployment)
      if (credentialsString.match(/^[A-Za-z0-9+/]+=*$/)) {
        console.log('Detected base64 credentials, decoding...')
        const decoded = Buffer.from(credentialsString, 'base64').toString('utf8')
        const parsed = JSON.parse(decoded)
        console.log('Successfully parsed base64-encoded credentials')
        return parsed
      }

      // Strategy 2: Direct JSON parse (for properly formatted JSON)
      try {
        const parsed = JSON.parse(credentialsString)
        console.log('Successfully parsed direct JSON credentials')
        return parsed
      } catch {
        // Continue to next strategy
      }

      // Strategy 3: Fix escaped newlines and parse
      const cleaned = credentialsString.replace(/\\n/g, '\n')
      const parsed = JSON.parse(cleaned)
      console.log('Successfully parsed credentials after newline fix')
      return parsed

    } catch (error) {
      console.error('All credential parsing strategies failed:', error instanceof Error ? error.message : 'Unknown error')
      throw new Error(`Google Cloud credentials parsing failed. Format the credentials as base64 or properly escaped JSON. Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  constructor() {
    let credentials = undefined

    // Method 1: Try individual environment variables (preferred)
    if (process.env.GOOGLE_CLOUD_TYPE && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
      console.log('Using individual Google Cloud environment variables')
      credentials = {
        type: process.env.GOOGLE_CLOUD_TYPE,
        project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
        private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
        auth_uri: process.env.GOOGLE_CLOUD_AUTH_URI,
        token_uri: process.env.GOOGLE_CLOUD_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_CLOUD_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLOUD_CLIENT_X509_CERT_URL,
        universe_domain: process.env.GOOGLE_CLOUD_UNIVERSE_DOMAIN
      }
      console.log('Successfully loaded Google Cloud credentials from individual env vars')
    }
    // Method 2: Fallback to JSON credentials
    else if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
      try {
        credentials = this.parseCredentialsJson(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON)
        console.log('Successfully loaded Google Cloud credentials from JSON')
      } catch (error) {
        console.error('Failed to parse Google Cloud JSON credentials:', error instanceof Error ? error.message : 'Unknown error')
        // Continue without credentials - will fall back to other auth methods
      }
    }

    // Initialize Google Cloud authentication with fallback options
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: credentials,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    })

    this.visionClient = new ImageAnnotatorClient({
      auth: this.auth,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    })
  }

  /**
   * Perform reverse image search using Google Cloud Vision API
   */
  async reverseImageSearch(imageUrl: string): Promise<VisionSearchResult[]> {
    try {
      console.log(`Starting Google Vision reverse search for: ${imageUrl}`)

      // Step 1: Use Vision API to analyze the image
      const imageAnalysis = await this.analyzeImage(imageUrl)

      // Step 2: Use web detection to find similar images
      const webDetection = await this.detectWebImages(imageUrl)

      // Step 3: Combine and process results
      const results = this.processVisionResults(webDetection, imageAnalysis)

      console.log(`Google Vision found ${results.length} results`)
      return results

    } catch (error) {
      console.error('Google Vision API error:', error)
      throw new Error(`Vision API failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze image content using Vision API
   */
  private async analyzeImage(imageUrl: string) {
    const [result] = await this.visionClient.annotateImage({
      image: { source: { imageUri: imageUrl } },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'TEXT_DETECTION' },
        { type: 'LOGO_DETECTION' },
        { type: 'SAFE_SEARCH_DETECTION' },
        { type: 'IMAGE_PROPERTIES' }
      ]
    })

    return {
      labels: result.labelAnnotations || [],
      text: result.textAnnotations || [],
      logos: result.logoAnnotations || [],
      safeSearch: result.safeSearchAnnotation,
      properties: result.imagePropertiesAnnotation
    }
  }

  /**
   * Detect web images and sources using Vision API
   */
  private async detectWebImages(imageUrl: string) {
    const [result] = await this.visionClient.annotateImage({
      image: { source: { imageUri: imageUrl } },
      features: [
        { type: 'WEB_DETECTION', maxResults: 20 }
      ]
    })

    return result.webDetection
  }

  /**
   * Process Vision API results focusing on EXACT matches and high-quality sources
   */
  private processVisionResults(webDetection: any, imageAnalysis: any): VisionSearchResult[] {
    const results: VisionSearchResult[] = []

    console.log('Processing Vision results for EXACT matches:')
    console.log('Raw webDetection:', JSON.stringify(webDetection, null, 2))

    // Focus on EXACT matches - fullMatchingImages are the most reliable
    if (webDetection?.pagesWithMatchingImages) {
      console.log(`Found ${webDetection.pagesWithMatchingImages.length} pages with matching images`)

      for (const page of webDetection.pagesWithMatchingImages) {
        // Only process pages that have FULL matching images (exact matches)
        if (page.fullMatchingImages && page.fullMatchingImages.length > 0) {
          // Try to get URL from multiple sources
          let pageUrl = page.url || ''
          let sourceInfo = { source: 'Unknown Source', license: '', creator: '' }

          // If we have a page URL, use it
          if (pageUrl) {
            sourceInfo = this.extractSourceInfo(pageUrl, page.pageTitle || '')
          }
          // If no page URL, try to extract from the image URL
          else if (page.fullMatchingImages[0]?.url) {
            const imageUrl = page.fullMatchingImages[0].url
            sourceInfo = this.extractSourceInfo(imageUrl, page.pageTitle || '')
            pageUrl = this.constructSourcePageUrl(imageUrl, sourceInfo.source)
          }

          // Skip generic or low-quality sources
          if (this.isQualitySource(sourceInfo.source, pageUrl)) {
            const result = {
              source_url: pageUrl,
              source_name: sourceInfo.source,
              title: page.pageTitle || '',
              creator: sourceInfo.creator,
              license_info: sourceInfo.license,
              similarity_score: 1.0, // Exact match
              thumbnail_url: page.fullMatchingImages[0].url
            }
            results.push(result)
            console.log(`Added EXACT match: ${sourceInfo.source} - ${pageUrl}`)
          } else {
            console.log(`Skipped low-quality source: ${sourceInfo.source} - ${pageUrl}`)
          }
        }
      }
    }

    // Process partialMatchingImages only if no full matches found
    if (results.length === 0 && webDetection?.pagesWithMatchingImages) {
      console.log('No full matches found, checking partial matches...')

      for (const page of webDetection.pagesWithMatchingImages.slice(0, 5)) {
        if (page.partialMatchingImages && page.partialMatchingImages.length > 0 && page.url) {
          const sourceInfo = this.extractSourceInfo(page.url, page.pageTitle || '')

          if (this.isQualitySource(sourceInfo.source, page.url)) {
            const result = {
              source_url: page.url,
              source_name: sourceInfo.source,
              title: page.pageTitle || '',
              creator: sourceInfo.creator,
              license_info: sourceInfo.license,
              similarity_score: 0.8, // Partial match
              thumbnail_url: page.partialMatchingImages[0].url
            }
            results.push(result)
            console.log(`Added PARTIAL match: ${sourceInfo.source} - ${page.url}`)
          }
        }
      }
    }

    console.log(`Final high-quality results: ${results.length}`)
    return results.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
  }

  /**
   * Construct a source page URL from an image URL when possible
   */
  private constructSourcePageUrl(imageUrl: string, sourceName: string): string {
    try {
      const url = new URL(imageUrl)
      const domain = url.hostname.toLowerCase()

      // For Pexels, extract photo ID and construct page URL
      if (domain.includes('pexels')) {
        const photoMatch = imageUrl.match(/pexels-photo-(\d+)/) || imageUrl.match(/photos\/(\d+)/)
        if (photoMatch && photoMatch[1]) {
          return `https://www.pexels.com/photo/${photoMatch[1]}/`
        }
      }

      // For Unsplash, extract photo ID
      if (domain.includes('unsplash')) {
        const photoMatch = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/)
        if (photoMatch && photoMatch[1]) {
          return `https://unsplash.com/photos/${photoMatch[1]}`
        }
      }

      // For Pixabay, extract photo ID
      if (domain.includes('pixabay')) {
        const photoMatch = imageUrl.match(/pixabay\.com\/.*?(\d+)/)
        if (photoMatch && photoMatch[1]) {
          return `https://pixabay.com/photos/${photoMatch[1]}/`
        }
      }

      // For other sources, return the image URL as fallback
      return imageUrl

    } catch (error) {
      console.log('Error constructing source URL:', error)
      return imageUrl
    }
  }

  /**
   * Check if this is a quality source worth returning
   */
  private isQualitySource(sourceName: string, url: string): boolean {
    // Known quality stock photo sources
    const qualitySources = [
      'Shutterstock', 'Getty Images', 'Adobe Stock', 'iStock',
      'Unsplash', 'Pexels', 'Pixabay',
      'Flickr', 'Wikimedia', 'Wikipedia'
    ]

    // Check if it's a known quality source
    if (qualitySources.some(source => sourceName.includes(source))) {
      return true
    }

    // Skip generic/low-quality domains
    const lowQualityPatterns = [
      'pinterest', 'facebook', 'twitter', 'instagram',
      'reddit', 'tumblr', 'blogspot', 'wordpress.com'
    ]

    const urlLower = url.toLowerCase()
    if (lowQualityPatterns.some(pattern => urlLower.includes(pattern))) {
      return false
    }

    // Accept other domains that might be original sources
    return true
  }

  /**
   * Extract source information from URL and title
   */
  private extractSourceInfo(url: string, title: string) {
    let source = 'Unknown Source'
    let license = ''
    let creator = ''

    try {
      const domain = new URL(url).hostname.toLowerCase()

      // Detect stock photo sources
      if (domain.includes('shutterstock')) {
        source = 'Shutterstock'
        license = 'Licensed Stock Photo'
      } else if (domain.includes('gettyimages')) {
        source = 'Getty Images'
        license = 'Licensed Stock Photo'
      } else if (domain.includes('adobe') && domain.includes('stock')) {
        source = 'Adobe Stock'
        license = 'Licensed Stock Photo'
      } else if (domain.includes('istock')) {
        source = 'iStock'
        license = 'Licensed Stock Photo'
      } else if (domain.includes('unsplash')) {
        source = 'Unsplash'
        license = 'Free License (Unsplash)'
      } else if (domain.includes('pexels')) {
        source = 'Pexels'
        license = 'Free License (Pexels)'
      } else if (domain.includes('pixabay')) {
        source = 'Pixabay'
        license = 'Free License (Pixabay)'
      } else if (domain.includes('flickr')) {
        source = 'Flickr'
        license = 'Various Licenses'
      } else {
        source = domain.replace('www.', '').replace('.com', '').replace('.org', '')
      }

      // Extract creator from title
      if (title) {
        const creatorPatterns = [
          /by\s+([^-|,]+)/i,
          /photo\s+by\s+([^-|,]+)/i,
          /image\s+by\s+([^-|,]+)/i,
          /credit:\s*([^-|,]+)/i
        ]

        for (const pattern of creatorPatterns) {
          const match = title.match(pattern)
          if (match && match[1]) {
            creator = match[1].trim()
            break
          }
        }
      }

    } catch (error) {
      console.error('Error extracting source info:', error)
    }

    return { source, license, creator }
  }

  /**
   * Get project configuration info
   */
  getConfig() {
    return {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      hasCredentials: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS_JSON),
      isConfigured: !!(process.env.GOOGLE_CLOUD_PROJECT_ID && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS_JSON))
    }
  }
}