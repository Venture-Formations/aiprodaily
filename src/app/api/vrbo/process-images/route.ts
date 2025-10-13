import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processVrboImage } from '@/lib/vrbo-image-processor'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { listing_id, force_reprocess = false } = body

    if (listing_id) {
      // Process a specific listing
      const { data: listing, error: fetchError } = await supabaseAdmin
        .from('vrbo_listings')
        .select('*')
        .eq('id', listing_id)
        .single()

      if (fetchError || !listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }

      if (!listing.main_image_url) {
        return NextResponse.json({ error: 'No main image URL found for this listing' }, { status: 400 })
      }

      if (listing.adjusted_image_url && !force_reprocess) {
        return NextResponse.json({
          message: 'Listing already has processed image. Use force_reprocess=true to reprocess.',
          current_url: listing.adjusted_image_url
        })
      }

      console.log(`Processing image for VRBO listing: ${listing.title}`)
      const result = await processVrboImage(listing.main_image_url, listing.title, listing.id)

      if (result.success && result.adjusted_image_url) {
        // Update the listing with the processed image URL
        const { error: updateError } = await supabaseAdmin
          .from('vrbo_listings')
          .update({ adjusted_image_url: result.adjusted_image_url })
          .eq('id', listing_id)

        if (updateError) {
          console.error('Error updating listing with processed image:', updateError)
          return NextResponse.json({
            success: false,
            error: 'Image processed but failed to update database'
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          listing_id,
          title: listing.title,
          original_url: listing.main_image_url,
          processed_url: result.adjusted_image_url,
          message: 'Image processed and listing updated successfully'
        })
      } else {
        return NextResponse.json({
          success: false,
          error: result.error || 'Image processing failed'
        }, { status: 500 })
      }
    } else {
      // Process all listings without adjusted images
      const { data: listings, error: fetchError } = await supabaseAdmin
        .from('vrbo_listings')
        .select('*')
        .or('adjusted_image_url.is.null,adjusted_image_url.eq.')
        .not('main_image_url', 'is', null)

      if (fetchError) {
        return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
      }

      if (!listings || listings.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No listings found that need image processing',
          processed: 0
        })
      }

      const results = []
      let processed = 0
      let errors = 0

      for (const listing of listings) {
        console.log(`Processing image for VRBO listing: ${listing.title}`)

        try {
          const result = await processVrboImage(listing.main_image_url, listing.title, listing.id)

          if (result.success && result.adjusted_image_url) {
            // Update the listing
            const { error: updateError } = await supabaseAdmin
              .from('vrbo_listings')
              .update({ adjusted_image_url: result.adjusted_image_url })
              .eq('id', listing.id)

            if (updateError) {
              console.error(`Error updating listing ${listing.id}:`, updateError)
              results.push({
                listing_id: listing.id,
                title: listing.title,
                success: false,
                error: 'Database update failed'
              })
              errors++
            } else {
              results.push({
                listing_id: listing.id,
                title: listing.title,
                success: true,
                processed_url: result.adjusted_image_url
              })
              processed++
            }
          } else {
            results.push({
              listing_id: listing.id,
              title: listing.title,
              success: false,
              error: result.error || 'Processing failed'
            })
            errors++
          }

          // Add small delay between requests to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (error) {
          results.push({
            listing_id: listing.id,
            title: listing.title,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        message: `Batch processing completed. Processed: ${processed}, Errors: ${errors}`,
        total_listings: listings.length,
        processed,
        errors,
        results
      })
    }

  } catch (error) {
    console.error('VRBO image processing API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}