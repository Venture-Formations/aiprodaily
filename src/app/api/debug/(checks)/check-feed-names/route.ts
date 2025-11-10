import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all RSS feeds
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, active, url')
      .order('name')

    if (feedsError) {
      console.error('Feeds query error:', feedsError)
      throw feedsError
    }

    return NextResponse.json({
      success: true,
      feeds: feeds || [],
      message: `Found ${feeds?.length || 0} RSS feeds`
    })

  } catch (error) {
    console.error('Error checking feed names:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}