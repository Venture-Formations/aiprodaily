import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the ad belongs to this user and is awaiting approval
    const { data: ad, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, clerk_user_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    if (ad.clerk_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (ad.status !== 'awaiting_approval') {
      return NextResponse.json({ error: 'Ad is not awaiting approval' }, { status: 400 })
    }

    // Update status to approved
    const { error: updateError } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to approve ad:', updateError)
      return NextResponse.json({ error: 'Failed to approve ad' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Ad approval error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

