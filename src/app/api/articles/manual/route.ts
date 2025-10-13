import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { campaign_id, title, content, image_url, source_url, rank } = body

    if (!campaign_id || !title || !content) {
      return NextResponse.json({
        error: 'campaign_id, title, and content are required'
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
        campaign_id,
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
        campaign_id,
        action: 'manual_article_created',
        details: { article_id: article.id, title }
      }])

    return NextResponse.json({ article }, { status: 201 })

  } catch (error) {
    console.error('Failed to create manual article:', error)
    return NextResponse.json({
      error: 'Failed to create manual article',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const campaign_id = url.searchParams.get('campaign_id')

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    const { data: articles, error } = await supabaseAdmin
      .from('manual_articles')
      .select('*')
      .eq('campaign_id', campaign_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ articles: articles || [] })

  } catch (error) {
    console.error('Failed to fetch manual articles:', error)
    return NextResponse.json({
      error: 'Failed to fetch manual articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}