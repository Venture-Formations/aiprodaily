import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getWordleDataForDate } from '@/lib/wordle-scraper'

async function collectWordleData(date: string, forceRefresh = false) {
  console.log(`🧩 Collecting Wordle data for ${date}...`)

  // Check if we already have data for this date
  const { data: existing } = await supabaseAdmin
    .from('wordle')
    .select('*')
    .eq('date', date)
    .single()

  if (existing && !forceRefresh) {
    console.log(`✅ Wordle data already exists for ${date}`)
    return existing
  }

  if (forceRefresh && existing) {
    console.log(`🔄 Force refresh enabled - will update existing data for ${date}`)
  }

  // Scrape Wordle data from Tom's Guide archive
  console.log('🌐 Scraping Wordle data from Tom\'s Guide archive...')
  const wordleData = await getWordleDataForDate(date)

  if (!wordleData) {
    console.log('No Wordle answer found via web scraping')
    return null
  }

  console.log('Successfully scraped Wordle data:', wordleData.word)

  // Insert or update database (upsert for force refresh)
  const { data: newWordle, error } = await supabaseAdmin
    .from('wordle')
    .upsert([{
      date,
      word: wordleData.word.toUpperCase(),
      definition: wordleData.definition,
      interesting_fact: wordleData.interesting_fact
    }], {
      onConflict: 'date'
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to upsert Wordle data:', error)
    throw new Error(`Database upsert failed: ${error.message}`)
  }

  console.log(`✅ Wordle data collected and stored for ${date}:`, newWordle.word)
  return newWordle
}

// POST handler for Vercel cron
export async function POST(request: NextRequest) {
  console.log('🧩 Starting automated Wordle collection cron job...')

  try {
    // Verify cron secret for security (only for POST/cron requests)
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Cron authentication successful')

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    const wordleData = await collectWordleData(today)

    if (!wordleData) {
      return NextResponse.json({
        success: true,
        message: 'No Wordle answer found for today',
        data: null
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Wordle data collected successfully',
      data: {
        id: wordleData.id,
        date: wordleData.date,
        word: wordleData.word,
        definition: wordleData.definition.substring(0, 50) + '...',
        interesting_fact: wordleData.interesting_fact.substring(0, 50) + '...'
      }
    })

  } catch (error) {
    console.error('❌ Wordle collection cron job failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET handler for Vercel cron (newer pattern) and manual testing
export async function GET(request: NextRequest) {
  console.log('🧩 Starting Wordle collection...')

  try {
    // Check for manual testing with secret parameter
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // For manual testing, require secret parameter
    if (secret && secret !== process.env.CRON_SECRET) {
      console.log('❌ Invalid secret for manual testing')
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Allow Vercel cron (no secret) or manual testing (with correct secret)
    console.log('✅ Request authorized')

    // Get parameters
    const dateParam = searchParams.get('date')
    const forceRefresh = searchParams.get('force') === 'true'

    // Use specified date or today's date in YYYY-MM-DD format
    const targetDate = dateParam || new Date().toISOString().split('T')[0]

    const wordleData = await collectWordleData(targetDate, forceRefresh)

    if (!wordleData) {
      return NextResponse.json({
        success: true,
        message: `No Wordle answer found for ${targetDate}`,
        data: null
      })
    }

    return NextResponse.json({
      success: true,
      message: secret ? 'Manual Wordle collection successful' : 'Automated Wordle collection successful',
      data: {
        id: wordleData.id,
        date: wordleData.date,
        word: wordleData.word,
        definition: wordleData.definition,
        interesting_fact: wordleData.interesting_fact,
        created_at: wordleData.created_at
      }
    })

  } catch (error) {
    console.error('❌ Wordle collection failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}