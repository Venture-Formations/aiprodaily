import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const updates = await request.json()

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'description',
      'start_date',
      'end_date',
      'venue',
      'address',
      'url'
    ]

    const filteredUpdates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    filteredUpdates.updated_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('events')
      .update(filteredUpdates)
      .eq('id', id)

    if (error) throw error

    // Log the update
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
            action: 'event_submission_edited',
            details: {
              event_id: id,
              fields_updated: Object.keys(filteredUpdates)
            }
          }])
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to update submission:', error)
    return NextResponse.json({
      error: 'Failed to update submission',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
