import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/polls/[id] - Get single poll
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    return NextResponse.json({ poll })
  } catch (error) {
    console.error('Error in GET /api/polls/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch poll' },
      { status: 500 }
    )
  }
}

// PATCH /api/polls/[id] - Update poll
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, question, options, is_active } = body

    // If setting this poll as active, deactivate all others first
    if (is_active) {
      await supabaseAdmin
        .from('polls')
        .update({ is_active: false })
        .eq('is_active', true)
        .neq('id', id)
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (question !== undefined) updateData.question = question
    if (options !== undefined) updateData.options = options
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ poll })
  } catch (error) {
    console.error('Error in PATCH /api/polls/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to update poll' },
      { status: 500 }
    )
  }
}

// DELETE /api/polls/[id] - Delete poll
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting poll:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/polls/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete poll' },
      { status: 500 }
    )
  }
}
