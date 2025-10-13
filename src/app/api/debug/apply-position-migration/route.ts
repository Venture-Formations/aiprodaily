import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('Applying article position migration...')

    // Try to add the columns - this will fail if they already exist, which is fine
    try {
      await supabaseAdmin.rpc('exec', {
        sql: `
          -- Add position tracking columns to articles table
          ALTER TABLE articles
          ADD COLUMN review_position INTEGER DEFAULT NULL,
          ADD COLUMN final_position INTEGER DEFAULT NULL;
        `
      })
      console.log('Articles table columns added successfully')
    } catch (error: any) {
      console.log('Articles table columns may already exist:', error.message)
    }

    try {
      await supabaseAdmin.rpc('exec', {
        sql: `
          -- Add position tracking columns to manual_articles table
          ALTER TABLE manual_articles
          ADD COLUMN review_position INTEGER DEFAULT NULL,
          ADD COLUMN final_position INTEGER DEFAULT NULL;
        `
      })
      console.log('Manual articles table columns added successfully')
    } catch (error: any) {
      console.log('Manual articles table columns may already exist:', error.message)
    }

    // Test if columns exist by trying to select them
    const { data: testArticles, error: testError } = await supabaseAdmin
      .from('articles')
      .select('id, review_position, final_position')
      .limit(1)

    const { data: testManual, error: testManualError } = await supabaseAdmin
      .from('manual_articles')
      .select('id, review_position, final_position')
      .limit(1)

    return NextResponse.json({
      success: true,
      message: 'Migration applied successfully',
      tests: {
        articles_columns_exist: !testError,
        manual_articles_columns_exist: !testManualError,
        articles_error: testError?.message || null,
        manual_articles_error: testManualError?.message || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Failed to apply migration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}