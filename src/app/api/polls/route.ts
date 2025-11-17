import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Poll } from '@/types/database'

// GET /api/polls - Get all polls for a publication
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')
    const activeOnly = searchParams.get('active') === 'true'

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('polls')
      .select('id, publication_id, title, question, options, is_active, created_at, updated_at')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true).limit(1)
    }

    const { data: polls, error } = await query

    if (error) {
      console.error('[Polls] Error fetching polls:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      polls: activeOnly ? (polls?.[0] || null) : polls
    })
  } catch (error) {
    console.error('[Polls] Error in GET /api/polls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    )
  }
}

// POST /api/polls - Create new poll for a publication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publication_id, title, question, options, is_active } = body

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    if (!title || !question || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, question, options' },
        { status: 400 }
      )
    }

    if (options.length < 2) {
      return NextResponse.json(
        { error: 'Poll must have at least 2 options' },
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
    }

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .insert({
        publication_id,
        title,
        question,
        options,
        is_active: is_active || false
      })
      .select('id, publication_id, title, question, options, is_active, created_at, updated_at')
      .single()

    if (error) {
      console.error('[Polls] Error creating poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Polls] Created poll "${title}" for publication ${publication_id}`)
    return NextResponse.json({ poll }, { status: 201 })
  } catch (error) {
    console.error('[Polls] Error in POST /api/polls:', error)
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    )
  }
}
