import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'articles/manual' },
  async ({ request, session }) => {
    const body = await request.json()
    const { issue_id, title, content, image_url, source_url, rank } = body

    if (!issue_id || !title || !content) {
      return NextResponse.json({
        error: 'issue_id, title, and content are required'
      }, { status: 400 })
    }

    // Get user ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user?.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create manual article
    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .insert([{
        issue_id,
        title,
        content,
        image_url: image_url || null,
        source_url: source_url || null,
        rank: rank || null,
        created_by: user.id,
        is_active: true
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    // Log user activity
    await supabaseAdmin
      .from('user_activities')
      .insert([{
        user_id: user.id,
        issue_id,
        action: 'manual_article_created',
        details: { article_id: article.id, title }
      }])

    return NextResponse.json({ article }, { status: 201 })
  }
)

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'articles/manual' },
  async ({ request }) => {
    const url = new URL(request.url)
    const issue_id = url.searchParams.get('issue_id')

    if (!issue_id) {
      return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
    }

    const { data: articles, error } = await supabaseAdmin
      .from('manual_articles')
      .select('*')
      .eq('issue_id', issue_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ articles: articles || [] })
  }
)
