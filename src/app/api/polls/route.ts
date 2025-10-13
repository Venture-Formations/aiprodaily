import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Poll } from '@/types/database'

// GET /api/polls - Get all polls or active poll
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('active') === 'true'

    let query = supabaseAdmin
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true).limit(1)
    }

    const { data: polls, error } = await query

    if (error) {
      console.error('Error fetching polls:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      polls: activeOnly ? (polls?.[0] || null) : polls
    })
  } catch (error) {
    console.error('Error in GET /api/polls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    )
  }
}

// POST /api/polls - Create new poll
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, question, options, is_active } = body

    if (!title || !question || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, question, options' },
        { status: 400 }
      )
    }

    // If setting this poll as active, deactivate all others first
    if (is_active) {
      await supabaseAdmin
        .from('polls')
        .update({ is_active: false })
        .eq('is_active', true)
    }

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .insert({
        title,
        question,
        options,
        is_active: is_active || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ poll }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/polls:', error)
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    )
  }
}
