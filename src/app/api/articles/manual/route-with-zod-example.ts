import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { CreateManualArticleSchema, GetManualArticlesSchema } from '@/lib/validation/article-schemas'
import { ZodError } from 'zod'

/**
 * POST /api/articles/manual
 * Create a new manual article with Zod validation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()

    // ✅ Zod validates everything in one line
    const validated = CreateManualArticleSchema.parse(body)

    // ✅ TypeScript now knows exact types:
    // - validated.campaign_id is a valid UUID string
    // - validated.title is a string (1-500 chars)
    // - validated.content is a string (1-50k chars)
    // - validated.rank is a number (1-100) or undefined
    // - validated.image_url is a valid URL or undefined
    // - validated.source_url is a valid URL or undefined

    // Get user ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user?.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create manual article with validated data
    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .insert([{
        campaign_id: validated.campaign_id,
        title: validated.title,
        content: validated.content,
        image_url: validated.image_url || null,
        source_url: validated.source_url || null,
        rank: validated.rank || null,
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
        campaign_id: validated.campaign_id,
        action: 'manual_article_created',
        details: { article_id: article.id, title: validated.title }
      }])

    return NextResponse.json({ article }, { status: 201 })

  } catch (error) {
    // ✅ Zod errors provide detailed, user-friendly messages
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, { status: 400 })
    }

    console.error('Failed to create manual article:', error)
    return NextResponse.json({
      error: 'Failed to create manual article',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/articles/manual?campaign_id=xxx
 * Fetch manual articles with Zod validation
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const campaign_id = url.searchParams.get('campaign_id')

    // ✅ Zod validates query params
    const validated = GetManualArticlesSchema.parse({ campaign_id })

    const { data: articles, error } = await supabaseAdmin
      .from('manual_articles')
      .select('*')
      .eq('campaign_id', validated.campaign_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ articles: articles || [] })

  } catch (error) {
    // ✅ Consistent error handling
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, { status: 400 })
    }

    console.error('Failed to fetch manual articles:', error)
    return NextResponse.json({
      error: 'Failed to fetch manual articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 600
