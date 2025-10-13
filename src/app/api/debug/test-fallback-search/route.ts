import { NextRequest, NextResponse } from 'next/server'

interface SearchResult {
  source_url: string
  source_name: string
  title?: string
  creator?: string
  license_info?: string
  similarity_score?: number
  method: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    }

    console.log('Testing fallback search methods for:', imageUrl)
    const results: SearchResult[] = []

    // Method 1: Extract source from URL patterns
    const urlPatterns = await testUrlPatternMethod(imageUrl)
    results.push(...urlPatterns)

    // Method 2: TinEye API (if configured)
    try {
      const tinEyeResults = await testTinEyeSearch(imageUrl)
      results.push(...tinEyeResults)
    } catch (error) {
      console.log('TinEye not configured:', error)
    }

    // Method 3: SerpAPI (if configured)
    try {
      const serpResults = await testSerpApiSearch(imageUrl)
      results.push(...serpResults)
    } catch (error) {
      console.log('SerpAPI not configured:', error)
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      results,
      totalResults: results.length,
      methods: {
        urlPattern: urlPatterns.length,
        tinEye: results.filter(r => r.method === 'TinEye').length,
        serpApi: results.filter(r => r.method === 'SerpAPI').length
      }
    })

  } catch (error) {
    console.error('Fallback search error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function testUrlPatternMethod(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  try {
    const url = new URL(imageUrl)
    const domain = url.hostname.toLowerCase()

    // Detect source from URL patterns
    if (domain.includes('unsplash')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Unsplash',
        license_info: 'Free License (Unsplash)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })

      // Try to get the original Unsplash page
      const photoId = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/)?.[1]
      if (photoId) {
        results.push({
          source_url: `https://unsplash.com/photos/${photoId}`,
          source_name: 'Unsplash',
          title: 'Original Unsplash Page',
          license_info: 'Free License (Unsplash)',
          similarity_score: 1.0,
          method: 'URL Pattern'
        })
      }
    } else if (domain.includes('pexels')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Pexels',
        license_info: 'Free License (Pexels)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('pixabay')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Pixabay',
        license_info: 'Free License (Pixabay)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('shutterstock')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Shutterstock',
        license_info: 'Licensed Stock Photo',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('gettyimages')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Getty Images',
        license_info: 'Licensed Stock Photo',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    }

  } catch (error) {
    console.log('URL pattern detection failed:', error)
  }

  return results
}

async function testTinEyeSearch(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  const TINEYE_API_KEY = process.env.TINEYE_API_KEY
  if (!TINEYE_API_KEY) {
    throw new Error('TinEye API key not configured')
  }

  const response = await fetch('https://api.tineye.com/rest/search/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      api_key: TINEYE_API_KEY,
      image_url: imageUrl,
      sort: 'score',
      order: 'desc'
    })
  })

  if (response.ok) {
    const data = await response.json()
    if (data.results && data.results.matches) {
      for (const match of data.results.matches.slice(0, 10)) {
        results.push({
          source_url: match.backlinks[0]?.url || '',
          source_name: extractSourceName(match.backlinks[0]?.url || ''),
          similarity_score: match.score,
          title: match.backlinks[0]?.crawl_date,
          method: 'TinEye'
        })
      }
    }
  }

  return results
}

async function testSerpApiSearch(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  const SERPAPI_KEY = process.env.SERPAPI_KEY
  if (!SERPAPI_KEY) {
    throw new Error('SerpAPI key not configured')
  }

  const response = await fetch(`https://serpapi.com/search.json?engine=google_reverse_image&image_url=${encodeURIComponent(imageUrl)}&api_key=${SERPAPI_KEY}`)

  if (response.ok) {
    const data = await response.json()
    if (data.image_results) {
      for (const result of data.image_results.slice(0, 10)) {
        const sourceInfo = extractStockPhotoInfo(result.link, result.title)
        results.push({
          source_url: result.link,
          source_name: sourceInfo.source,
          title: result.title,
          creator: sourceInfo.creator,
          license_info: sourceInfo.license,
          similarity_score: 0.8,
          method: 'SerpAPI'
        })
      }
    }
  }

  return results
}

function extractSourceName(url: string): string {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    if (domain.includes('shutterstock')) return 'Shutterstock'
    if (domain.includes('gettyimages')) return 'Getty Images'
    if (domain.includes('unsplash')) return 'Unsplash'
    if (domain.includes('pexels')) return 'Pexels'
    if (domain.includes('pixabay')) return 'Pixabay'
    if (domain.includes('adobe')) return 'Adobe Stock'
    if (domain.includes('istock')) return 'iStock'
    return domain.replace('www.', '')
  } catch {
    return 'Unknown Source'
  }
}

function extractStockPhotoInfo(url: string, title: string) {
  const sourceName = extractSourceName(url)
  let creator = ''
  let license = ''

  // Extract creator from title patterns
  const creatorMatch = title.match(/by\s+([^-|]+)/i) || title.match(/photo\s+by\s+([^-|]+)/i)
  if (creatorMatch) {
    creator = creatorMatch[1].trim()
  }

  // Determine license based on source
  if (['Unsplash', 'Pexels', 'Pixabay'].includes(sourceName)) {
    license = 'Free License'
  } else if (['Shutterstock', 'Getty Images', 'Adobe Stock', 'iStock'].includes(sourceName)) {
    license = 'Licensed Stock Photo'
  }

  return { source: sourceName, creator, license }
}