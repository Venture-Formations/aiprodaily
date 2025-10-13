import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GitHubImageStorage } from '@/lib/github-storage'
import { ImageReviewRequest } from '@/types/database'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      image_id,
      tags,
      crop_v_offset,
      ai_caption,
      ai_alt_text,
      ai_tags,
      ai_tags_scored,
      license,
      credit,
      city,
      location, // Keep for backwards compatibility
      source,
      source_url,
      original_file_name,
      ocr_text
    } = body

    // Get current image data
    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', image_id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Update the image record with user edits
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Update tags from review page if provided
    if (tags !== undefined) updateData.ai_tags = tags

    // Only update other fields that were provided
    if (ai_caption !== undefined) updateData.ai_caption = ai_caption
    if (ai_alt_text !== undefined) updateData.ai_alt_text = ai_alt_text
    if (ai_tags !== undefined) updateData.ai_tags = ai_tags
    if (ai_tags_scored !== undefined) updateData.ai_tags_scored = ai_tags_scored
    if (license !== undefined) updateData.license = license
    if (credit !== undefined) updateData.credit = credit
    if (city !== undefined) updateData.city = city
    if (location !== undefined) updateData.city = location // Backwards compatibility
    if (source !== undefined) updateData.source = source
    if (source_url !== undefined) updateData.source_url = source_url
    if (original_file_name !== undefined) updateData.original_file_name = original_file_name
    if (crop_v_offset !== undefined) updateData.crop_v_offset = crop_v_offset
    if (ocr_text !== undefined) updateData.ocr_text = ocr_text

    const { error: updateError } = await supabaseAdmin
      .from('images')
      .update(updateData)
      .eq('id', image_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update image' },
        { status: 500 }
      )
    }

    // If crop offset was updated, regenerate the 16:9 variant
    if (crop_v_offset !== undefined) {
      console.log(`Crop offset updated for image ${image_id}: ${crop_v_offset}`)

      try {
        // Download original image from Supabase
        const originalImageUrl = image.cdn_url
        const imageResponse = await fetch(originalImageUrl)

        if (!imageResponse.ok) {
          console.error(`Failed to download original image: ${imageResponse.status}`)
        } else {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

          // Get image dimensions
          const metadata = await sharp(imageBuffer).metadata()
          const originalWidth = metadata.width || 1920
          const originalHeight = metadata.height || 1080

          // Calculate 16:9 crop dimensions and position
          const targetAspectRatio = 16 / 9
          const originalAspectRatio = originalWidth / originalHeight

          let cropWidth: number
          let cropHeight: number
          let cropLeft: number
          let cropTop: number

          if (originalAspectRatio > targetAspectRatio) {
            // Image is wider than 16:9, crop horizontally (keep full height)
            cropHeight = originalHeight
            cropWidth = Math.round(cropHeight * targetAspectRatio)
            cropLeft = Math.round((originalWidth - cropWidth) / 2)
            cropTop = 0
          } else {
            // Image is taller than 16:9, crop vertically
            cropWidth = originalWidth
            cropHeight = Math.round(cropWidth / targetAspectRatio)
            cropLeft = 0
            // Apply vertical offset
            const maxTop = originalHeight - cropHeight
            cropTop = Math.round(crop_v_offset * maxTop)
          }

          // Create 16:9 variant at 1200x675
          const croppedBuffer = await sharp(imageBuffer)
            .extract({
              left: cropLeft,
              top: cropTop,
              width: cropWidth,
              height: cropHeight
            })
            .resize(1200, 675, {
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 85 })
            .toBuffer()

          // Upload to GitHub
          const githubStorage = new GitHubImageStorage()
          const githubUrl = await githubStorage.uploadImageVariant(
            croppedBuffer,
            image_id,
            '1200x675',
            ai_caption || 'Image library variant'
          )

          if (githubUrl) {
            // Update database with variant URLs
            const variantKey = `images/variants/1200x675/${image_id}.jpg`
            const cdnUrl = githubStorage.getCdnUrl(image_id, '1200x675')

            await supabaseAdmin
              .from('images')
              .update({
                variant_16x9_key: variantKey,
                variant_16x9_url: cdnUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', image_id)

            console.log(`Generated 16:9 variant for image ${image_id}: ${cdnUrl}`)
          }
        }
      } catch (cropError) {
        console.error(`Error generating 16:9 variant for image ${image_id}:`, cropError)
        // Continue without failing the entire request
      }
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Image updated successfully'
    })

  } catch (error) {
    console.error('Image review commit API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}