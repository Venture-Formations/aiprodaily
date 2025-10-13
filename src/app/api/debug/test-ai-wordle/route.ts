import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') || '2025-09-29'

    console.log('🧩 Testing AI-powered Wordle content extraction for:', targetDate)

    // Fetch the page content to see what AI is analyzing
    const response = await fetch("https://www.tomsguide.com/news/what-is-todays-wordle-answer", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract the same content that the AI would analyze
    $('script, style, nav, header, footer, .advertisement, .ad').remove()
    const articleText = $('.article-content, .entry-content, main, article').text() || $('body').text()
    const contentForAI = articleText.substring(0, 4000)

    // Find all headings to understand page structure
    const headings: string[] = []
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      headings.push($(element).text().trim())
    })

    // Try to find both today's sections
    let hintsSection = ''
    let answerSection = ''

    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const headingText = $(element).text().trim()
      let content = ''
      let nextElement = $(element).next()
      while (nextElement.length > 0 && !nextElement.is('h1, h2, h3, h4, h5, h6')) {
        content += nextElement.text() + ' '
        nextElement = nextElement.next()
      }

      if (headingText.toLowerCase().includes("today's wordle answer — hints")) {
        hintsSection = content.trim()
      } else if (headingText.toLowerCase() === "today's wordle answer") {
        answerSection = content.trim()
      }
    })

    return NextResponse.json({
      success: true,
      date: targetDate,
      contentLength: contentForAI.length,
      contentPreview: contentForAI.substring(0, 500),
      headings: headings,
      hintsSection: hintsSection,
      hintsLength: hintsSection.length,
      answerSection: answerSection,
      answerLength: answerSection.length,
      debug: {
        message: 'Page structure analysis showing both hints and answer sections'
      }
    })

  } catch (error) {
    console.error('❌ Content analysis test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}