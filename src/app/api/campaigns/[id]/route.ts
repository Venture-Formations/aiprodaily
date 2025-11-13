import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*),
        email_metrics(*),
        issue_ai_app_selections(
          *,
          app:ai_applications(*)
        ),
        issue_advertisements(
          *,
          advertisement:advertisements(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      throw error
    }

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    return NextResponse.json({ issue })

  } catch (error) {
    console.error('Failed to fetch issue:', error)
    return NextResponse.json({
      error: 'Failed to fetch issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await request.json()
    const { status, subject_line } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (subject_line !== undefined) updateData.subject_line = subject_line

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw error
    }

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
            action: 'issue_updated',
            details: updateData
          }])
      }
    }

    return NextResponse.json({ issue })

  } catch (error) {
    console.error('Failed to update issue:', error)
    return NextResponse.json({
      error: 'Failed to update issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}