import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { getCurrentTopArticle, generateSubjectLine } from '@/lib/subject-line-generator'

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

    // Get the article to verify it exists and check its rank
    const { data: article, error: articleError } = await supabaseAdmin
      .from('articles')
      .select('id, campaign_id, headline, rank, is_active')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      console.error('Article query error:', articleError)
      return NextResponse.json({
        error: 'Article not found',
        details: articleError?.message || 'Article does not exist'
      }, { status: 404 })
    }

    // Check if this article is currently the #1 article (for subject line regeneration)
    const { article: currentTopArticle } = await getCurrentTopArticle(article.campaign_id)
    const isCurrentTopArticle = currentTopArticle?.id === articleId

    console.log(`Skipping article: "${article.headline}" (rank: ${article.rank})`)
    if (isCurrentTopArticle) {
      console.log('This is the current #1 article - will regenerate subject line after skipping')
    }

    // Mark article as inactive and record that it was skipped
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({
        is_active: false,
        skipped: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('Failed to skip article:', updateError)

      // Provide helpful error message if column doesn't exist
      if (updateError.message?.includes('column "skipped" of relation "articles" does not exist')) {
        return NextResponse.json({
          error: 'Database setup required',
          details: 'The skipped column needs to be added to the database. Please run: /api/debug/add-skip-column',
          sqlCommand: 'ALTER TABLE articles ADD COLUMN skipped BOOLEAN DEFAULT FALSE;'
        }, { status: 500 })
      }

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
            action: 'article_skipped',
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
      console.error('Failed to log article skip action:', logError)
      // Don't fail the request if logging fails
    }

    // Auto-regenerate subject line if we skipped the #1 article
    let subjectLineResult = null
    if (isCurrentTopArticle) {
      console.log('Auto-regenerating subject line since #1 article was skipped...')
      subjectLineResult = await generateSubjectLine(article.campaign_id, session.user?.email || undefined)

      if (subjectLineResult.success) {
        console.log(`Subject line auto-regenerated: "${subjectLineResult.subject_line}"`)
      } else {
        console.error('Failed to auto-regenerate subject line:', subjectLineResult.error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Article skipped successfully (marked as inactive)',
      article: {
        id: articleId,
        is_active: false,
        skipped: true
      },
      subject_line_regenerated: isCurrentTopArticle,
      new_subject_line: subjectLineResult?.success ? subjectLineResult.subject_line : null
    })

  } catch (error) {
    console.error('Article skip failed:', error)
    return NextResponse.json({
      error: 'Failed to skip article',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}