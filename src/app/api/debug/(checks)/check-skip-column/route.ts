import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-skip-column' },
  async ({ logger }) => {
    // First, let's test selecting an article without the skipped column
    console.log('Testing article query without skipped column...')
    const { data: articlesBasic, error: basicError } = await supabaseAdmin
      .from('articles')
      .select('id, issue_id, headline')
      .limit(1)

    if (basicError) {
      console.error('Basic article query error:', basicError)
      return NextResponse.json({
        error: 'Basic article query failed',
        details: basicError.message
      })
    }

    console.log('Basic article query success:', articlesBasic)

    // Now test with skipped column
    console.log('Testing article query with skipped column...')
    const { data: articlesWithSkipped, error: skippedError } = await supabaseAdmin
      .from('articles')
      .select('id, issue_id, headline, skipped')
      .limit(1)

    if (skippedError) {
      console.error('Skipped column query error:', skippedError)

      // Try to add the column
      console.log('Attempting to add skipped column...')
      const { data: alterResult, error: alterError } = await supabaseAdmin
        .rpc('exec_sql', {
          sql: 'ALTER TABLE articles ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE;'
        })

      if (alterError) {
        console.error('Failed to add skipped column:', alterError)
        return NextResponse.json({
          error: 'Skipped column missing and could not add it',
          basicQuery: { success: true, data: articlesBasic },
          skippedError: skippedError.message,
          alterError: alterError.message
        })
      }

      console.log('Column added, retesting...')
      const { data: retestArticles, error: retestError } = await supabaseAdmin
        .from('articles')
        .select('id, issue_id, headline, skipped')
        .limit(1)

      return NextResponse.json({
        success: true,
        message: 'Skipped column added successfully',
        basicQuery: { success: true, data: articlesBasic },
        columnAdded: true,
        retestQuery: { success: !retestError, data: retestArticles, error: retestError?.message }
      })
    }

    console.log('Skipped column query success:', articlesWithSkipped)

    return NextResponse.json({
      success: true,
      message: 'Skipped column already exists and working',
      basicQuery: { success: true, data: articlesBasic },
      skippedQuery: { success: true, data: articlesWithSkipped }
    })
  }
)
