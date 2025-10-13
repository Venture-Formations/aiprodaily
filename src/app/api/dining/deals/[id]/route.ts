import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updateData: any = {}

    // Only include fields that are provided
    if (body.business_name !== undefined) updateData.business_name = body.business_name
    if (body.business_address !== undefined) updateData.business_address = body.business_address
    if (body.google_profile !== undefined) updateData.google_profile = body.google_profile
    if (body.day_of_week !== undefined) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      if (!validDays.includes(body.day_of_week)) {
        return NextResponse.json(
          { error: 'Invalid day_of_week. Must be one of: ' + validDays.join(', ') },
          { status: 400 }
        )
      }
      updateData.day_of_week = body.day_of_week
    }
    if (body.special_description !== undefined) updateData.special_description = body.special_description
    if (body.special_time !== undefined) updateData.special_time = body.special_time
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data: deal, error } = await supabaseAdmin
      .from('dining_deals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating dining deal:', error)
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
    }

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Dining deal update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if deal exists
    const { data: existingDeal, error: fetchError } = await supabaseAdmin
      .from('dining_deals')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Delete the deal (this will also delete any campaign selections due to cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('dining_deals')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting dining deal:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Deal deleted successfully' })
  } catch (error) {
    console.error('Dining deal deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}