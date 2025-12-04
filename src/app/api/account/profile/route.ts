import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

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
      tagline, 
      description, 
      websiteUrl, 
      categoryIds,
      logoFileName,
      listingFileName 
    } = body

    // Verify the tool belongs to this user
    const { data: existingTool, error: fetchError } = await supabaseAdmin
      .from('tools_directory')
      .select('id, clerk_user_id, status')
      .eq('id', toolId)
      .single()

    if (fetchError || !existingTool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    if (existingTool.clerk_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Build update object
    const updateData: Record<string, any> = {
      tool_name: toolName,
      tagline: tagline || null,
      description,
      website_url: websiteUrl,
      updated_at: new Date().toISOString(),
    }

    // If tool is already approved, mark as 'edited' for admin review
    if (existingTool.status === 'approved') {
      updateData.status = 'edited'
    }

    // Add image URLs if new images were uploaded
    if (logoFileName) {
      updateData.logo_image_url = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/master/public/images/tools/${logoFileName}`
    }
    if (listingFileName) {
      updateData.tool_image_url = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/master/public/images/tools/${listingFileName}`
    }

    // Update tool
    const { error: updateError } = await supabaseAdmin
      .from('tools_directory')
      .update(updateData)
      .eq('id', toolId)

    if (updateError) {
      console.error('Failed to update tool:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Update categories if provided
    if (categoryIds && categoryIds.length > 0) {
      // Delete existing category associations
      await supabaseAdmin
        .from('directory_categories_tools')
        .delete()
        .eq('tool_id', toolId)

      // Insert new category associations
      const categoryInserts = categoryIds.map((categoryId: string) => ({
        tool_id: toolId,
        category_id: categoryId,
      }))

      const { error: categoryError } = await supabaseAdmin
        .from('directory_categories_tools')
        .insert(categoryInserts)

      if (categoryError) {
        console.error('Failed to update categories:', categoryError)
        // Don't fail the whole request for category issues
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

