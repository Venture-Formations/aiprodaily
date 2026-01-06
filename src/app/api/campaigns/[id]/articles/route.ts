import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await request.json()
    const { article_updates } = body

    if (!Array.isArray(article_updates)) {
      return NextResponse.json({ error: 'article_updates must be an array' }, { status: 400 })
    }

    // Update articles in batch
    const updatePromises = article_updates.map(async (update: any) => {
      const { article_id, is_active, rank } = update

      const updateData: any = {}
      if (typeof is_active === 'boolean') updateData.is_active = is_active
      if (typeof rank === 'number') updateData.rank = rank

      return supabaseAdmin
        .from('articles')
        .update(updateData)
        .eq('id', article_id)
        .eq('issue_id', id)
    })

    await Promise.all(updatePromises)

    // Log user activity
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: id,
            action: 'articles_updated',
            details: { updates_count: article_updates.length }
          }])
      }
    }

    // Auto-regenerate text box blocks (fire and forget - don't wait)
    console.log('[API] Auto-regenerating text box blocks after article updates...')
    import('@/lib/text-box-modules').then(({ TextBoxGenerator }) => {
      TextBoxGenerator.autoRegenerateBlocks(id, session.user?.email || undefined).then(result => {
        if (result.success) {
          console.log(`[API] Text box blocks auto-regenerated successfully (${result.regenerated} blocks)`)
        } else {
          console.error('[API] Failed to auto-regenerate text box blocks:', result.error)
        }
      }).catch(error => {
        console.error('[API] Text box regeneration error:', error)
      })
    })

    return NextResponse.json({ success: true, updated: article_updates.length })

  } catch (error) {
    console.error('Failed to update articles:', error)
    return NextResponse.json({
      error: 'Failed to update articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
