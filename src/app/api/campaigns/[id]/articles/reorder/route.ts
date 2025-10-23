import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { getCurrentTopArticle, generateSubjectLine } from '@/lib/subject-line-generator'
import { autoRegenerateWelcome } from '@/lib/welcome-section-generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const body = await request.json()
    const { articleOrders } = body

    if (!Array.isArray(articleOrders)) {
      return NextResponse.json({ error: 'articleOrders must be an array' }, { status: 400 })
    }

    // Get the current #1 article before reordering
    const { article: previousTopArticle } = await getCurrentTopArticle(campaignId)
    const previousTopArticleId = previousTopArticle?.id

    console.log(`Current #1 article before reorder: ${previousTopArticle?.headline || 'None'} (ID: ${previousTopArticleId || 'N/A'})`)

    // Update each article's rank
    console.log('Updating article ranks:', articleOrders.map(o => `Article ${o.articleId} -> rank ${o.rank}`).join(', '))

    const updatePromises = articleOrders.map(({ articleId, rank }) =>
      supabaseAdmin
        .from('articles')
        .update({ rank })
        .eq('id', articleId)
        .eq('campaign_id', campaignId)
    )

    const results = await Promise.all(updatePromises)
    console.log('Rank update results:', results.map((r, i) => `Article ${articleOrders[i].articleId}: ${r.error ? 'ERROR' : 'SUCCESS'}`).join(', '))

    // Check if any of the updates failed
    const hasErrors = results.some(result => result.error)
    if (hasErrors) {
      console.error('Some article rank updates failed')
      return NextResponse.json({
        error: 'Failed to update some article ranks',
        details: results.filter(r => r.error).map(r => r.error)
      }, { status: 500 })
    }

    // Get the new #1 article after reordering
    const { article: newTopArticle } = await getCurrentTopArticle(campaignId)
    const newTopArticleId = newTopArticle?.id

    console.log(`New #1 article after reorder: ${newTopArticle?.headline || 'None'} (ID: ${newTopArticleId || 'N/A'})`)

    // Auto-regenerate subject line if the #1 article changed
    let subjectLineResult = null
    const topArticleChanged = previousTopArticleId !== newTopArticleId

    if (topArticleChanged && newTopArticle) {
      console.log('The #1 article changed during reordering - auto-regenerating subject line...')
      subjectLineResult = await generateSubjectLine(campaignId, session.user?.email || undefined)

      if (subjectLineResult.success) {
        console.log(`Subject line auto-regenerated: "${subjectLineResult.subject_line}"`)
      } else {
        console.error('Failed to auto-regenerate subject line:', subjectLineResult.error)
      }
    } else if (!topArticleChanged) {
      console.log('The #1 article did not change - no subject line regeneration needed')
    } else if (!newTopArticle) {
      console.log('No new #1 article found - cannot regenerate subject line')
    }

    // Auto-regenerate welcome section (fire and forget - don't wait)
    console.log('Auto-regenerating welcome section after article reorder...')
    autoRegenerateWelcome(campaignId, session.user?.email || undefined).then(result => {
      if (result.success) {
        console.log('Welcome section auto-regenerated successfully after reorder')
      } else {
        console.error('Failed to auto-regenerate welcome after reorder:', result.error)
      }
    }).catch(error => {
      console.error('Welcome regeneration error after reorder:', error)
    })

    return NextResponse.json({
      success: true,
      subject_line_regenerated: topArticleChanged && newTopArticle,
      new_subject_line: subjectLineResult?.success ? subjectLineResult.subject_line : null,
      top_article_changed: topArticleChanged,
      previous_top_article: previousTopArticle?.headline,
      new_top_article: newTopArticle?.headline
    })

  } catch (error) {
    console.error('Failed to reorder articles:', error)
    return NextResponse.json({
      error: 'Failed to reorder articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}