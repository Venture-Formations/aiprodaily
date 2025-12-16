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
    const {
      toolId,
      toolName,
      description,
      websiteUrl,
      category,
      logoFileName,
      listingFileName
    } = body

    // Verify the tool belongs to this user in ai_applications table
    const { data: existingTool, error: fetchError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, clerk_user_id, submission_status, is_featured, listing_type, category')
      .eq('id', toolId)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (fetchError || !existingTool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    if (existingTool.clerk_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If user is featured and trying to change category, verify the new category doesn't have a featured tool
    const isFeatured = existingTool.is_featured || existingTool.listing_type === 'featured'
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

    // Add image URLs if new images were uploaded
    if (logoFileName) {
      updateData.logo_url = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/master/public/images/tools/${logoFileName}`
    }
    if (listingFileName) {
      updateData.screenshot_url = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/master/public/images/tools/${listingFileName}`
    }

    // Update tool in ai_applications
    const { error: updateError } = await supabaseAdmin
      .from('ai_applications')
      .update(updateData)
      .eq('id', toolId)
      .eq('publication_id', PUBLICATION_ID)

    if (updateError) {
      console.error('Failed to update tool:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
