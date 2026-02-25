import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ad-pricing' },
  async () => {
    const { data: tiers, error } = await supabaseAdmin
      .from('ad_pricing_tiers')
      .select('*')
      .order('frequency', { ascending: true })
      .order('min_quantity', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tiers })
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ad-pricing' },
  async ({ request }) => {
    const body = await request.json()
    const { frequency, min_quantity, max_quantity, price_per_unit } = body

    // Validation
    if (!frequency || !min_quantity || !price_per_unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('ad_pricing_tiers')
      .insert({
        frequency,
        min_quantity,
        max_quantity,
        price_per_unit
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tier: data })
  }
)

export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ad-pricing' },
  async ({ request }) => {
    const body = await request.json()
    const { id, price_per_unit } = body

    if (!id || !price_per_unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('ad_pricing_tiers')
      .update({ price_per_unit })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tier: data })
  }
)

export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ad-pricing' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing tier ID' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('ad_pricing_tiers')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
