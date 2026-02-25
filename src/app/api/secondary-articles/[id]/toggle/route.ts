import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'secondary-articles/[id]/toggle' },
  async ({ request, params, session }) => {
    const articleId = params.id
    const body = await request.json()
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
    }

    // Get the article to verify it exists
    const { data: article, error: articleError } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, issue_id, headline')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      return NextResponse.json({
        error: 'Secondary article not found',
        details: articleError?.message || 'Secondary article does not exist'
      }, { status: 404 })
    }

    // Update the article's active status
    const { error: updateError } = await supabaseAdmin
      .from('secondary_articles')
      .update({
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('Failed to toggle secondary article:', updateError)
      return NextResponse.json({
        error: 'Failed to toggle secondary article',
        details: updateError.message
      }, { status: 500 })
    }

    // Log the toggle action
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
            action: is_active ? 'secondary_article_activated' : 'secondary_article_deactivated',
            details: {
              article_id: articleId,
              issue_id: article.issue_id,
              article_headline: article.headline,
              toggled_by: session.user?.email,
              toggled_at: new Date().toISOString(),
              new_status: is_active
            }
          }])
      }
    } catch (logError) {
      console.error('Failed to log secondary article toggle action:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Secondary article ${is_active ? 'activated' : 'deactivated'} successfully`,
      article: {
        id: articleId,
        is_active
      }
    })
  }
)
