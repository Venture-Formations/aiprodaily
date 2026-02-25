import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/newsletters - List all active newsletters
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'newsletters' },
  async () => {
    // Return all newsletters (including inactive ones) for admin view
    // Frontend can filter by is_active if needed
    const { data: newsletters, error } = await supabaseAdmin
      .from('publications')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      newsletters: newsletters || []
    })
  }
)

/**
 * POST /api/newsletters - Create new newsletter
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'newsletters' },
  async ({ request }) => {
    const body = await request.json()
    const { slug, name, subdomain, description, logo_url, primary_color } = body

    // Validate required fields
    if (!slug || !name || !subdomain) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: slug, name, subdomain' },
        { status: 400 }
      )
    }

    // Insert newsletter
    const { data: newsletter, error } = await supabaseAdmin
      .from('publications')
      .insert({
        slug,
        name,
        subdomain,
        description,
        logo_url,
        primary_color: primary_color || '#3B82F6'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      newsletter
    })
  }
)
