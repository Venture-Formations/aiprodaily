import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: articleId } = await params

    // Get the article to verify it exists
    const { data: article, error: articleError } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, campaign_id, headline, rank, is_active')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      console.error('Secondary article query error:', articleError)
      return NextResponse.json({
        error: 'Secondary article not found',
        details: articleError?.message || 'Secondary article does not exist'
      }, { status: 404 })
    }

    console.log(`Skipping secondary article: "${article.headline}" (rank: ${article.rank})`)

    // Mark article as inactive and record that it was skipped
    const { error: updateError } = await supabaseAdmin
      .from('secondary_articles')
      .update({
        is_active: false,
        skipped: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('Failed to skip secondary article:', updateError)

      // Provide helpful error message if column doesn't exist
      if (updateError.message?.includes('column "skipped" of relation "secondary_articles" does not exist')) {
        return NextResponse.json({
          error: 'Database setup required',
          details: 'The skipped column needs to be added to the secondary_articles table. Please run: /api/debug/setup-secondary-articles',
          sqlCommand: 'ALTER TABLE secondary_articles ADD COLUMN skipped BOOLEAN DEFAULT FALSE;'
        }, { status: 500 })
      }

      return NextResponse.json({
        error: 'Failed to skip secondary article',
        details: updateError.message
      }, { status: 500 })
    }

    // Log the skip action
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user?.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: 'secondary_article_skipped',
            details: {
              article_id: articleId,
              campaign_id: article.campaign_id,
              article_headline: article.headline,
              skipped_by: session.user?.email,
              skipped_at: new Date().toISOString()
            }
          }])
      }
    } catch (logError) {
      console.error('Failed to log secondary article skip action:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Secondary article skipped successfully (marked as inactive)',
      article: {
        id: articleId,
        is_active: false,
        skipped: true
      }
    })

  } catch (error) {
    console.error('Secondary article skip failed:', error)
    return NextResponse.json({
      error: 'Failed to skip secondary article',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
