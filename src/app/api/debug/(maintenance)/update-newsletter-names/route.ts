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
  async ({ logger }) => {
  try {
    // Update newsletter names
    // Update accounting newsletter
    const { error: accountingError } = await supabaseAdmin
      .from('publications')
      .update({ name: 'AI Accounting Daily' })
      .eq('slug', 'accounting')

    if (accountingError) {
      return NextResponse.json({ error: accountingError.message }, { status: 500 })
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
      message: 'Newsletter names updated successfully'
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
