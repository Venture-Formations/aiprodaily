import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/secondary-articles/reorder' },
  async ({ params, session, request }) => {
    const issueId = params.id
    const body = await request.json()
    const { articleOrders } = body

    if (!Array.isArray(articleOrders)) {
      return NextResponse.json({ error: 'articleOrders must be an array' }, { status: 400 })
    }

    console.log('Updating secondary article ranks:', articleOrders.map(o => `Article ${o.articleId} -> rank ${o.rank}`).join(', '))

    // Update each article's rank
    const updatePromises = articleOrders.map(({ articleId, rank }) =>
      supabaseAdmin
        .from('secondary_articles')
        .update({ rank })
        .eq('id', articleId)
        .eq('issue_id', issueId)
    )

    const results = await Promise.all(updatePromises)
    console.log('Secondary rank update results:', results.map((r, i) => `Article ${articleOrders[i].articleId}: ${r.error ? 'ERROR' : 'SUCCESS'}`).join(', '))

    // Check if any of the updates failed
    const hasErrors = results.some(result => result.error)
    if (hasErrors) {
      console.error('Some secondary article rank updates failed')
      return NextResponse.json({
        error: 'Failed to update some secondary article ranks',
        details: results.filter(r => r.error).map(r => r.error)
      }, { status: 500 })
    }

    // Log the reorder action
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
            action: 'secondary_articles_reordered',
            details: {
              issue_id: issueId,
              article_orders: articleOrders,
              reordered_by: session.user?.email,
              reordered_at: new Date().toISOString()
            }
          }])
      }
    } catch (logError) {
      console.error('Failed to log secondary articles reorder action:', logError)
      // Don't fail the request if logging fails
    }

    // Auto-regenerate text box blocks (fire and forget - don't wait)
    console.log('Auto-regenerating text box blocks after secondary articles reorder...')
    import('@/lib/text-box-modules').then(({ TextBoxGenerator }) => {
      TextBoxGenerator.autoRegenerateBlocks(issueId, session.user?.email || undefined).then(result => {
        if (result.success) {
          console.log(`Text box blocks auto-regenerated successfully (${result.regenerated} blocks)`)
        } else {
          console.error('Failed to auto-regenerate text box blocks:', result.error)
        }
      }).catch(error => {
        console.error('Text box regeneration error:', error)
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Secondary articles reordered successfully'
    })
  }
)
