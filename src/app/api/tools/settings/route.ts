import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// Default pricing values
const DEFAULT_SETTINGS = {
  directory_paid_placement_price: '30',
  directory_featured_price: '60',
  directory_yearly_discount_months: '2'
}

// GET - Fetch directory pricing settings
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/settings' },
  async ({ logger }) => {
    // Fetch settings from publication_settings
    const { data: settings, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', PUBLICATION_ID)
      .in('key', Object.keys(DEFAULT_SETTINGS))

    if (error) {
      logger.error({ err: error }, 'Error fetching settings')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Merge with defaults
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS }
    settings?.forEach(s => {
      if (s.value !== null) {
        settingsMap[s.key] = s.value
      }
    })

    return NextResponse.json({
      success: true,
      settings: {
        paidPlacementPrice: parseFloat(settingsMap.directory_paid_placement_price),
        featuredPrice: parseFloat(settingsMap.directory_featured_price),
        yearlyDiscountMonths: parseInt(settingsMap.directory_yearly_discount_months)
      }
    })
  }
)

// POST - Update directory pricing settings
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/settings' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { paidPlacementPrice, featuredPrice, yearlyDiscountMonths } = body

    // Validate inputs
    if (paidPlacementPrice !== undefined && (isNaN(paidPlacementPrice) || paidPlacementPrice < 0)) {
      return NextResponse.json({ error: 'Invalid paid placement price' }, { status: 400 })
    }
    if (featuredPrice !== undefined && (isNaN(featuredPrice) || featuredPrice < 0)) {
      return NextResponse.json({ error: 'Invalid featured price' }, { status: 400 })
    }
    if (yearlyDiscountMonths !== undefined && (isNaN(yearlyDiscountMonths) || yearlyDiscountMonths < 0 || yearlyDiscountMonths > 11)) {
      return NextResponse.json({ error: 'Invalid yearly discount months (must be 0-11)' }, { status: 400 })
    }

    // Prepare upsert data
    const updates: { key: string; value: string }[] = []

    if (paidPlacementPrice !== undefined) {
      updates.push({ key: 'directory_paid_placement_price', value: paidPlacementPrice.toString() })
    }
    if (featuredPrice !== undefined) {
      updates.push({ key: 'directory_featured_price', value: featuredPrice.toString() })
    }
    if (yearlyDiscountMonths !== undefined) {
      updates.push({ key: 'directory_yearly_discount_months', value: yearlyDiscountMonths.toString() })
    }

    // Upsert each setting
    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('publication_settings')
        .upsert({
          publication_id: PUBLICATION_ID,
          key: update.key,
          value: update.value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'publication_id,key'
        })

      if (error) {
        logger.error({ err: error, key: update.key }, 'Error updating setting')
        return NextResponse.json({ error: `Failed to update ${update.key}` }, { status: 500 })
      }
    }

    logger.info({ updates }, 'Settings updated')

    return NextResponse.json({ success: true, message: 'Settings updated successfully' })
  }
)
