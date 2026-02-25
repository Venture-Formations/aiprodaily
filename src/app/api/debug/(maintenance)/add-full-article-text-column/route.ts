import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/add-full-article-text-column' },
  async ({ logger }) => {
  try {
    console.log('Checking for full_article_text column in rss_posts table...')

    // Test if the column exists by attempting to select it
    const { data, error } = await supabaseAdmin
      .from('rss_posts')
      .select('id, full_article_text')
      .limit(1)

    if (error) {
      // Column doesn't exist - provide SQL to run manually
      if (error.code === '42703') { // Column does not exist error
        return NextResponse.json({
          success: false,
          column_exists: false,
          message: 'Column full_article_text does not exist yet',
          sql_to_run: 'ALTER TABLE rss_posts ADD COLUMN full_article_text TEXT;',
          instructions: [
            '1. Go to Supabase SQL Editor',
            '2. Run the SQL command provided in the sql_to_run field',
            '3. Run this endpoint again to verify'
          ]
        })
      }

      return NextResponse.json({
        error: 'Failed to check column existence',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      column_exists: true,
      message: 'Column full_article_text exists and is ready to use',
      note: 'This column will store full article text extracted using Readability.js'
    })

  } catch (error: any) {
    console.error('Error checking column:', error)
    return NextResponse.json({
      error: 'Failed to check column',
      details: error.message
    }, { status: 500 })
  }
  }
)
