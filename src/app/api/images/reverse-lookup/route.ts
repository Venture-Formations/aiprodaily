import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GoogleVisionService } from '@/lib/google-vision'

interface ReverseSearchResult {
  source_url: string
  source_name: string
  title?: string
  creator?: string
  license_info?: string
  similarity_score?: number
  thumbnail_url?: string
}

export async function POST(request: NextRequest) {
  try {
    const { image_id } = await request.json()

    if (!image_id) {
      return NextResponse.json(
        { error: 'Image ID required' },
        { status: 400 }
      )
    }

    // Get the image data from database
    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', image_id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    const imageUrl = image.cdn_url
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL not available' },
        { status: 400 }
      )
    }

    console.log(`Performing reverse image lookup for image ${image_id}: ${imageUrl}`)

    // Perform reverse image search using multiple methods
    const results: ReverseSearchResult[] = []

    // Method 1: Google Cloud Vision API (primary method)
    try {
      const visionService = new GoogleVisionService()
      const visionConfig = visionService.getConfig()

      if (visionConfig.isConfigured) {
        console.log('Using Google Cloud Vision API for reverse search')
        const visionResults = await visionService.reverseImageSearch(imageUrl)
        results.push(...visionResults)
      } else {
        console.log('Google Cloud Vision not configured, skipping')
      }
    } catch (error) {
      console.log('Google Vision search failed:', error)
    }

    // Method 2: TinEye API (fallback)
    try {
      await performTinEyeSearch(imageUrl, results)
    } catch (error) {
      console.log('TinEye search failed:', error)
    }

    // Method 3: SerpAPI Google Images (fallback)
    try {
      await performSerpApiSearch(imageUrl, results)
    } catch (error) {
      console.log('SerpAPI search failed:', error)
    }

    // Method 4: Pattern-based detection (always available)
    try {
      await performPatternBasedSearch(image, results)
    } catch (error) {
      console.log('Pattern-based search failed:', error)
    }

    // Sort results by similarity score (if available)
    results.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))

    // Log results for debugging
    console.log(`Reverse lookup completed for ${image_id}. Found ${results.length} results.`)

    return NextResponse.json({
      success: true,
      image_id,
      results: results.slice(0, 10), // Return top 10 results
      total_found: results.length,
      lookup_timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Reverse lookup API error:', error)
    return NextResponse.json(
      {
        error: 'Reverse lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function performTinEyeSearch(imageUrl: string, results: ReverseSearchResult[]) {
  // TinEye API implementation (requires API key)
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
      for (const match of data.results.matches.slice(0, 5)) {
        results.push({
          source_url: match.backlinks[0]?.url || '',
          source_name: extractSourceName(match.backlinks[0]?.url || ''),
          similarity_score: match.score,
          title: match.backlinks[0]?.crawl_date
        })
      }
    }
  }
}

async function performSerpApiSearch(imageUrl: string, results: ReverseSearchResult[]) {
  // SerpAPI Google Images reverse search (requires API key)
  const SERPAPI_KEY = process.env.SERPAPI_KEY
  if (!SERPAPI_KEY) {
    throw new Error('SerpAPI key not configured')
  }

  const response = await fetch(`https://serpapi.com/search.json?engine=google_reverse_image&image_url=${encodeURIComponent(imageUrl)}&api_key=${SERPAPI_KEY}`)

  if (response.ok) {
    const data = await response.json()
    if (data.image_results) {
      for (const result of data.image_results.slice(0, 5)) {
        const sourceInfo = extractStockPhotoInfo(result.link, result.title)
        results.push({
          source_url: result.link,
          source_name: sourceInfo.source,
          title: result.title,
          creator: sourceInfo.creator,
          license_info: sourceInfo.license,
          similarity_score: 0.8 // Estimated score for Google results
        })
      }
    }
  }
}

async function performPatternBasedSearch(image: any, results: ReverseSearchResult[]) {
  // Pattern-based detection from filename or existing source_url
  const patterns = [
    {
      pattern: /shutterstock/i,
      source: 'Shutterstock',
      license: 'Licensed Stock Photo'
    },
    {
      pattern: /getty.*images/i,
      source: 'Getty Images',
      license: 'Licensed Stock Photo'
    },
    {
      pattern: /unsplash/i,
      source: 'Unsplash',
      license: 'Free License'
    },
    {
      pattern: /pexels/i,
      source: 'Pexels',
      license: 'Free License'
    },
    {
      pattern: /pixabay/i,
      source: 'Pixabay',
      license: 'Free License'
    },
    {
      pattern: /adobe.*stock/i,
      source: 'Adobe Stock',
      license: 'Licensed Stock Photo'
    }
  ]

  const searchText = `${image.original_file_name || ''} ${image.source_url || ''} ${image.cdn_url || ''}`.toLowerCase()

  for (const pattern of patterns) {
    if (pattern.pattern.test(searchText)) {
      results.push({
        source_url: image.source_url || '',
        source_name: pattern.source,
        license_info: pattern.license,
        similarity_score: 0.6 // Lower score for pattern matching
      })
    }
  }
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