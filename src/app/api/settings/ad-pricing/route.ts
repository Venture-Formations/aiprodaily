import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: tiers, error } = await supabaseAdmin
      .from('ad_pricing_tiers')
      .select('*')
      .order('frequency', { ascending: true })
      .order('min_quantity', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tiers })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch pricing tiers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to create pricing tier',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
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
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to update pricing tier',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
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
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete pricing tier',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
