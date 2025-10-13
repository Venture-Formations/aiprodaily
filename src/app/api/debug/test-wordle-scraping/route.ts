import { NextRequest, NextResponse } from 'next/server'
import { getPuzzleNumber, getWordleAnswer, getWordleDataForDate } from '@/lib/wordle-scraper'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') || '2024-01-01'

    console.log('🧩 Testing Wordle scraping for:', targetDate)

    // Test puzzle number calculation
    const puzzleNumber = getPuzzleNumber(targetDate)
    console.log('Calculated puzzle number:', puzzleNumber)

    // Test web scraping
    console.log('🌐 Testing web scraping...')
    const word = await getWordleAnswer(targetDate)
    console.log('Scraped word:', word)

    // Test complete data
    console.log('📊 Testing complete data retrieval...')
    const completeData = await getWordleDataForDate(targetDate)
    console.log('Complete data:', completeData)

    // Test fetching the Tom's Guide page
    console.log('🌐 Testing Tom\'s Guide page fetch...')
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
    const pageStatus = response.ok ? 'success' : 'failed'
    const pageLength = response.ok ? (await response.text()).length : 0

    console.log('Page fetch status:', pageStatus)
    console.log('Page content length:', pageLength)

    return NextResponse.json({
      success: true,
      date: targetDate,
      puzzleNumber: puzzleNumber,
      scrapedWord: word,
      completeData: completeData,
      tomGuideStatus: pageStatus,
      pageContentLength: pageLength,
      debug: {
        message: 'Check Vercel function logs for detailed console output'
      }
    })

  } catch (error) {
    console.error('❌ Wordle scraping test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}