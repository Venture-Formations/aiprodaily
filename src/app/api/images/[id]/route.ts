import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'images/[id]' },
  async ({ params }) => {
    const imageId = params.id

    const { data: image, error } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single()

    if (error || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(image)
  }
)

export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'images/[id]' },
  async ({ params }) => {
    const imageId = params.id

    // Get image data first to get the object key for storage deletion
    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('object_key, variant_16x9_key')
      .eq('id', imageId)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Delete from storage (original and variant if exists)
    const storageDeletes = [image.object_key]
    if (image.variant_16x9_key) {
      storageDeletes.push(image.variant_16x9_key)
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from('images')
      .remove(storageDeletes)

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabaseAdmin
      .from('images')
      .delete()
      .eq('id', imageId)

    if (dbError) {
      console.error('Database deletion error:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete image from database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    })
  }
)
