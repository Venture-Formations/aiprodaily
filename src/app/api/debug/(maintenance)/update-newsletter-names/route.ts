import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/update-newsletter-names' },
  async ({ logger }) => {
  try {
    // Get current newsletters
    const { data: newsletters, error: fetchError } = await supabaseAdmin
      .from('publications')
      .select('id, name, slug')
      .order('created_at')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newsletters,
      message: 'Current newsletter names'
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/update-newsletter-names' },
  async ({ request, logger }) => {
  try {
    const body = await request.json()
    const { slug, name } = body

    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 })
    }

    // Update newsletter name by slug
    const { error: updateError } = await supabaseAdmin
      .from('publications')
      .update({ name })
      .eq('slug', slug)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Get updated newsletters
    const { data: newsletters, error: fetchError } = await supabaseAdmin
      .from('publications')
      .select('id, name, slug')
      .order('created_at')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newsletters,
      message: `Newsletter "${slug}" renamed to "${name}" successfully`
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
