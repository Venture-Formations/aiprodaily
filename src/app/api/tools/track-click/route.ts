import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { incrementToolClicks, incrementToolViews } from '@/lib/directory'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

type ClickType = 'category_click' | 'tool_view' | 'external_link'

interface TrackClickPayload {
  // New enhanced tracking fields
  clickType?: ClickType
  toolId?: string
  toolName?: string
  categorySlug?: string
  categoryName?: string
  referrerPage?: string
  referrerType?: string
  destinationUrl?: string
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackClickPayload = await request.json()

    // Extract request metadata
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      null

    // Handle legacy requests (just toolId) for backwards compatibility
    if (!payload.clickType && payload.toolId) {
      // Legacy behavior: increment click count
      await incrementToolClicks(payload.toolId)
      return NextResponse.json({ success: true })
    }

    // Validate click type
    if (!payload.clickType || !['category_click', 'tool_view', 'external_link'].includes(payload.clickType)) {
      return NextResponse.json(
        { error: 'Invalid or missing clickType' },
        { status: 400 }
      )
    }

    // Validate required fields based on click type
    if (payload.clickType === 'category_click' && !payload.categorySlug) {
      return NextResponse.json(
        { error: 'categorySlug is required for category_click' },
        { status: 400 }
      )
    }

    if ((payload.clickType === 'tool_view' || payload.clickType === 'external_link') && !payload.toolId) {
      return NextResponse.json(
        { error: 'toolId is required for tool_view and external_link' },
        { status: 400 }
      )
    }

    // Insert detailed tracking record
    const { error: insertError } = await supabaseAdmin
      .from('tool_directory_clicks')
      .insert({
        publication_id: PUBLICATION_ID,
        click_type: payload.clickType,
        tool_id: payload.toolId || null,
        tool_name: payload.toolName || null,
        category_slug: payload.categorySlug || null,
        category_name: payload.categoryName || null,
        destination_url: payload.destinationUrl || null,
        referrer_page: payload.referrerPage || null,
        referrer_type: payload.referrerType || null,
        user_agent: userAgent,
        ip_address: ipAddress
      })

    if (insertError) {
      console.error('[Tools Track Click] Error inserting click record:', insertError)
      // Don't fail the request - tracking failures shouldn't block user
    }

    // Also update the legacy counters for backwards compatibility
    if (payload.toolId) {
      if (payload.clickType === 'tool_view') {
        // Increment view count
        incrementToolViews(payload.toolId).catch(err =>
          console.error('[Tools Track Click] Error incrementing view count:', err)
        )
      } else if (payload.clickType === 'external_link') {
        // Increment click count
        incrementToolClicks(payload.toolId).catch(err =>
          console.error('[Tools Track Click] Error incrementing click count:', err)
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Tools Track Click] Error tracking click:', error)
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    )
  }
}
