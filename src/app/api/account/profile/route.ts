import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function PUT(request: NextRequest) {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[Profile API] Request body:', JSON.stringify(body, null, 2))

    const {
      toolId,
      toolName,
      description,
      websiteUrl,
      category,
      logoUrl,
      listingUrl
    } = body

    // Verify the tool belongs to this user in ai_applications table
    const { data: existingTool, error: fetchError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, clerk_user_id, submission_status, is_featured, category')
      .eq('id', toolId)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (fetchError || !existingTool) {
      console.log('[Profile API] Tool not found. Error:', fetchError)
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    console.log('[Profile API] Found tool:', JSON.stringify(existingTool, null, 2))

    if (existingTool.clerk_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If user is featured and trying to change category, verify the new category doesn't have a featured tool
    const isFeatured = existingTool.is_featured
    if (isFeatured && category && category !== existingTool.category) {
      const { data: featuredInCategory } = await supabaseAdmin
        .from('ai_applications')
        .select('id')
        .eq('publication_id', PUBLICATION_ID)
        .eq('category', category)
        .eq('is_featured', true)
        .neq('id', toolId)
        .single()

      if (featuredInCategory) {
        return NextResponse.json({
          error: 'Cannot move to this category - it already has a featured tool'
        }, { status: 400 })
      }
    }

    // Build update object for ai_applications
    const updateData: Record<string, unknown> = {
      app_name: toolName,
      description,
      app_url: websiteUrl,
      updated_at: new Date().toISOString(),
    }

    // Update category if provided
    if (category) {
      updateData.category = category
    }

    // If tool is already approved, mark as 'edited' for admin review
    // If tool was rejected, set back to 'pending' for re-review
    if (existingTool.submission_status === 'approved') {
      updateData.submission_status = 'edited'
    } else if (existingTool.submission_status === 'rejected') {
      updateData.submission_status = 'pending'
      updateData.rejection_reason = null // Clear the rejection reason
      updateData.is_active = false // Ensure it stays inactive until approved
    }

    // Add image URLs if new images were uploaded (already Supabase Storage URLs)
    if (logoUrl) {
      updateData.logo_url = logoUrl
    }
    if (listingUrl) {
      updateData.screenshot_url = listingUrl
    }

    console.log('[Profile API] Update data:', JSON.stringify(updateData, null, 2))

    // Update tool in ai_applications
    const { error: updateError } = await supabaseAdmin
      .from('ai_applications')
      .update(updateData)
      .eq('id', toolId)
      .eq('publication_id', PUBLICATION_ID)

    if (updateError) {
      console.error('Failed to update tool:', updateError)
      console.error('Update data:', JSON.stringify(updateData, null, 2))
      return NextResponse.json({ error: 'Failed to update profile', details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Profile update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
