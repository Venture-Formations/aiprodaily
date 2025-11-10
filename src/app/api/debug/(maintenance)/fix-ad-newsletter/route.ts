import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to update advertisements with newsletter_id
 *
 * This fixes ads that were created without newsletter_id (NULL values)
 */
export async function POST() {
  try {
    // Get accounting newsletter UUID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json({
        error: 'Newsletter not found',
        details: newsletterError
      }, { status: 404 })
    }

    console.log(`[Fix Ad] Accounting newsletter ID: ${newsletter.id}`)

    // Get all ads with NULL newsletter_id
    const { data: adsWithoutNewsletter, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, title, newsletter_id')
      .is('newsletter_id', null)

    if (fetchError) {
      return NextResponse.json({
        error: 'Failed to fetch ads',
        details: fetchError
      }, { status: 500 })
    }

    console.log(`[Fix Ad] Found ${adsWithoutNewsletter?.length || 0} ads without newsletter_id`)

    if (!adsWithoutNewsletter || adsWithoutNewsletter.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No ads need updating',
        updated_count: 0
      })
    }

    // Update all ads to have the accounting newsletter_id
    const { data: updatedAds, error: updateError } = await supabaseAdmin
      .from('advertisements')
      .update({ newsletter_id: newsletter.id })
      .is('newsletter_id', null)
      .select('id, title')

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update ads',
        details: updateError
      }, { status: 500 })
    }

    console.log(`[Fix Ad] Updated ${updatedAds?.length || 0} ads`)

    return NextResponse.json({
      success: true,
      message: 'Advertisements updated successfully',
      newsletter_id: newsletter.id,
      newsletter_slug: 'accounting',
      updated_count: updatedAds?.length || 0,
      updated_ads: updatedAds
    })

  } catch (error) {
    console.error('[Fix Ad] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
