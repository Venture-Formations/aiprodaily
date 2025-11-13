import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
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

    const { id: issueId } = await params
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

    // Auto-regenerate welcome section (fire and forget - don't wait)
    console.log('Auto-regenerating welcome section after secondary articles reorder...')
    autoRegenerateWelcome(issueId, session.user?.email || undefined).then(result => {
      if (result.success) {
        console.log('Welcome section auto-regenerated successfully after secondary reorder')
      } else {
        console.error('Failed to auto-regenerate welcome after secondary reorder:', result.error)
      }
    }).catch(error => {
      console.error('Welcome regeneration error after secondary reorder:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Secondary articles reordered successfully'
    })

  } catch (error) {
    console.error('Failed to reorder secondary articles:', error)
    return NextResponse.json({
      error: 'Failed to reorder secondary articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
