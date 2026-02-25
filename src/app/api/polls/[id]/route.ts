import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

// GET /api/polls/[id] - Get single poll
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .select('id, publication_id, title, question, options, image_url, is_active, created_at, updated_at')
      .eq('id', id)
      .eq('publication_id', publicationId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
      }
      console.error('[Polls] Error fetching poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ poll })
  }
)

// PATCH /api/polls/[id] - Update poll
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const body = await request.json()
    const { publication_id, title, question, options, image_url, is_active } = body

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // If setting this poll as active, deactivate all others for this publication first
    if (is_active) {
      await supabaseAdmin
        .from('polls')
        .update({ is_active: false })
        .eq('publication_id', publication_id)
        .eq('is_active', true)
        .neq('id', id)
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (question !== undefined) updateData.question = question
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
        return NextResponse.json(
          { error: 'Poll must have at least 2 options' },
          { status: 400 }
        )
      }
      updateData.options = options
    }
    if (image_url !== undefined) updateData.image_url = image_url
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .update(updateData)
      .eq('id', id)
      .eq('publication_id', publication_id)
      .select('id, publication_id, title, question, options, image_url, is_active, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
      }
      console.error('[Polls] Error updating poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Polls] Updated poll ${id} for publication ${publication_id}`)
    return NextResponse.json({ poll })
  }
)

// DELETE /api/polls/[id] - Delete poll
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'polls/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', id)
      .eq('publication_id', publicationId)

    if (error) {
      console.error('[Polls] Error deleting poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Polls] Deleted poll ${id} from publication ${publicationId}`)
    return NextResponse.json({ success: true })
  }
)
