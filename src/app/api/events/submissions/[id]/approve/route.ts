import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail-service'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Get event details before updating
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('events')
      .update({
        submission_status: 'approved',
        active: true,
        reviewed_by: session.user?.email || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    // Send approval email
    if (event.submitter_email) {
      const gmail = new GmailService()
      await gmail.sendEventApprovalEmail({
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        end_date: event.end_date,
        venue: event.venue,
        address: event.address,
        url: event.url,
        website: event.website,
        submitter_email: event.submitter_email,
        submitter_name: event.submitter_name || 'Event Submitter'
      })
    }

    // Log the approval
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
            action: 'event_submission_approved',
            details: {
              event_id: id
            }
          }])
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to approve submission:', error)
    return NextResponse.json({
      error: 'Failed to approve submission',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
