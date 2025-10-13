import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('Checking VRBO listings image status...')

    // Get all VRBO listings
    const { data: listings, error } = await supabaseAdmin
      .from('vrbo_listings')
      .select('id, title, main_image_url, adjusted_image_url, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const analysis = {
      total_listings: listings?.length || 0,
      with_main_image: 0,
      with_adjusted_image: 0,
      needs_processing: 0,
      listings: listings || []
    }

    for (const listing of listings || []) {
      if (listing.main_image_url) {
        analysis.with_main_image++
      }
      if (listing.adjusted_image_url) {
        analysis.with_adjusted_image++
      }
      if (listing.main_image_url && !listing.adjusted_image_url) {
        analysis.needs_processing++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'VRBO image analysis completed',
      analysis
    })

  } catch (error) {
    console.error('VRBO image debug error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}