import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentTopArticle, generateSubjectLine } from '@/lib/subject-line-generator'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'articles/[id]/skip' },
  async ({ params, session, request }) => {
    const articleId = params.id

    // Get the article to verify it exists and check its rank
    const { data: article, error: articleError } = await supabaseAdmin
      .from('module_articles')
      .select('id, issue_id, headline, rank, is_active, article_module_id')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      console.error('Article query error:', articleError)
      return NextResponse.json({
        error: 'Article not found',
        details: articleError?.message || 'Article does not exist'
      }, { status: 404 })
    }

    // Verify tenant ownership via issue_id -> publication_issues
    const { data: issueOwner } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id')
      .eq('id', article.issue_id)
      .single()

    if (!issueOwner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if this article is currently the #1 article (for subject line regeneration)
    const { article: currentTopArticle } = await getCurrentTopArticle(article.issue_id)
    const isCurrentTopArticle = currentTopArticle?.id === articleId

    console.log(`Skipping article: "${article.headline}" (rank: ${article.rank})`)
    if (isCurrentTopArticle) {
      console.log('This is the current #1 article - will regenerate subject line after skipping')
    }

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
            action: 'article_skipped',
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

    // Auto-regenerate subject line if we skipped the #1 article
    let subjectLineResult = null
    if (isCurrentTopArticle) {
      console.log('Auto-regenerating subject line since #1 article was skipped...')
      subjectLineResult = await generateSubjectLine(article.issue_id, session.user?.email || undefined)

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
  }
)
