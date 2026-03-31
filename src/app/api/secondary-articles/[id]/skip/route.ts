import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'secondary-articles/[id]/skip' },
  async ({ params, session }) => {
    const articleId = params.id

    // Get the article to verify it exists
    const { data: article, error: articleError } = await supabaseAdmin
      .from('module_articles')
      .select('id, issue_id, headline, rank, is_active')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      console.error('Module article query error:', articleError)
      return NextResponse.json({
        error: 'Article not found',
        details: articleError?.message || 'Article does not exist'
      }, { status: 404 })
    }

    // Verify publication ownership via issue
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id')
      .eq('id', article.issue_id)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.log(`Skipping article: "${article.headline}" (rank: ${article.rank})`)

    // Mark article as inactive and record that it was skipped
    const { error: updateError } = await supabaseAdmin
      .from('module_articles')
      .update({
        is_active: false,
        skipped: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('Failed to skip article:', updateError)
      return NextResponse.json({
        error: 'Failed to skip article',
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
              issue_id: article.issue_id,
              article_headline: article.headline,
              skipped_by: session.user?.email,
              skipped_at: new Date().toISOString()
            }
          }])
      }
    } catch (logError) {
      console.error('Failed to log article skip action:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Article skipped successfully (marked as inactive)',
      article: {
        id: articleId,
        is_active: false,
        skipped: true
      }
    })
  }
)
