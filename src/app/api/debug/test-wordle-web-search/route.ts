import { NextResponse } from 'next/server'
import { getWordleDataForDate } from '@/lib/wordle-scraper'

export async function GET() {
  try {
    console.log('Testing Wordle web search implementation...')

    // Test with September 28, 2025 (yesterday)
    console.log('\n=== Testing September 28, 2025 ===')
    const result28 = await getWordleDataForDate('2025-09-28')
    console.log('Result for 2025-09-28:', result28)

    // Test with September 27, 2025 (we know this should be "FRITZ")
    console.log('\n=== Testing September 27, 2025 ===')
    const result27 = await getWordleDataForDate('2025-09-27')
    console.log('Result for 2025-09-27:', result27)

    // Test with today (September 29, 2025)
    console.log('\n=== Testing September 29, 2025 ===')
    const result29 = await getWordleDataForDate('2025-09-29')
    console.log('Result for 2025-09-29:', result29)

    return NextResponse.json({
      success: true,
      results: {
        '2025-09-28': result28,
        '2025-09-27': result27,
        '2025-09-29': result29
      },
      message: 'Wordle web search test completed'
    })

  } catch (error) {
    console.error('Error testing Wordle web search:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}