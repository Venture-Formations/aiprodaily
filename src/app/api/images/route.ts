import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ImageSearchFilters } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse search filters from query params
    const filters: ImageSearchFilters = {
      text_search: searchParams.get('search') || undefined,
      orientation: searchParams.get('orientation') as any || undefined,
      has_faces: searchParams.get('has_faces') === 'true' ? true : searchParams.get('has_faces') === 'false' ? false : undefined,
      has_text: searchParams.get('has_text') === 'true' ? true : searchParams.get('has_text') === 'false' ? false : undefined,
      license: searchParams.get('license') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    }

    // Build query
    let query = supabaseAdmin
      .from('images')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.text_search) {
      // Search in caption, alt text, and tags
      query = query.or(`ai_caption.ilike.%${filters.text_search}%,ai_alt_text.ilike.%${filters.text_search}%`)
    }

    if (filters.orientation) {
      query = query.eq('orientation', filters.orientation)
    }

    if (filters.has_faces !== undefined) {
      if (filters.has_faces) {
        query = query.gt('faces_count', 0)
      } else {
        query = query.eq('faces_count', 0)
      }
    }

    if (filters.has_text !== undefined) {
      query = query.eq('has_text', filters.has_text)
    }

    if (filters.license) {
      query = query.eq('license', filters.license)
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to)
    }

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
    }

    const { data: images, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch images' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      images: images || [],
      count: images?.length || 0
    })

  } catch (error) {
    console.error('Images API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}