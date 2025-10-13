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
    if (body.title !== undefined) updateData.title = body.title
    if (body.city !== undefined) updateData.city = body.city
    if (body.bedrooms !== undefined) updateData.bedrooms = body.bedrooms ? parseInt(body.bedrooms) : null
    if (body.bathrooms !== undefined) updateData.bathrooms = body.bathrooms ? parseFloat(body.bathrooms) : null
    if (body.sleeps !== undefined) updateData.sleeps = body.sleeps ? parseInt(body.sleeps) : null
    if (body.listing_type !== undefined) {
      if (!['Local', 'Greater'].includes(body.listing_type)) {
        return NextResponse.json(
          { error: 'listing_type must be either "Local" or "Greater"' },
          { status: 400 }
        )
      }
      updateData.listing_type = body.listing_type
    }
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.link !== undefined) updateData.link = body.link
    if (body.non_tracked_link !== undefined) updateData.non_tracked_link = body.non_tracked_link
    if (body.main_image_url !== undefined) updateData.main_image_url = body.main_image_url
    if (body.adjusted_image_url !== undefined) updateData.adjusted_image_url = body.adjusted_image_url

    const { data: listing, error } = await supabaseAdmin
      .from('vrbo_listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating VRBO listing:', error)
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
    }

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (error) {
    console.error('VRBO listing update error:', error)
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

    // Check if listing exists
    const { data: existingListing, error: fetchError } = await supabaseAdmin
      .from('vrbo_listings')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingListing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Delete the listing (this will also delete any campaign selections due to cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('vrbo_listings')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting VRBO listing:', deleteError)
      return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Listing deleted successfully' })
  } catch (error) {
    console.error('VRBO listing deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}