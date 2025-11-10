import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('[Ad Ordering Migration] Starting database migration...')

    // Step 1: Add app settings for tracking
    console.log('[Ad Ordering Migration] Adding app settings...')

    const settingsToAdd = [
      {
        key: 'next_ad_position',
        value: '1',
        description: 'The position number of the next advertisement to display in newsletters'
      },
      {
        key: 'ads_per_newsletter',
        value: '1',
        description: 'Number of advertisements to include in each newsletter (affects article count: 5 total items)'
      }
    ]

    for (const setting of settingsToAdd) {
      const { error: settingError } = await supabaseAdmin
        .from('app_settings')
        .upsert(
          {
            key: setting.key,
            value: setting.value,
            description: setting.description,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        )

      if (settingError) {
        console.error(`[Ad Ordering Migration] Error adding ${setting.key}:`, settingError)
      } else {
        console.log(`[Ad Ordering Migration] ✓ Added setting: ${setting.key}`)
      }
    }

    // Step 3: Initialize display_order for existing active ads
    console.log('[Ad Ordering Migration] Initializing display_order for active ads...')

    const { data: activeAds, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch active ads: ${fetchError.message}`)
    }

    if (activeAds && activeAds.length > 0) {
      for (let i = 0; i < activeAds.length; i++) {
        const { error: updateError } = await supabaseAdmin
          .from('advertisements')
          .update({ display_order: i + 1 })
          .eq('id', activeAds[i].id)

        if (updateError) {
          console.error(`[Ad Ordering Migration] Error updating ad ${activeAds[i].id}:`, updateError)
        }
      }

      console.log(`[Ad Ordering Migration] ✓ Initialized ${activeAds.length} active ads`)
    }

    // Step 2: Set display_order to NULL for non-active ads
    console.log('[Ad Ordering Migration] Clearing display_order for non-active ads...')

    const { error: clearError } = await supabaseAdmin
      .from('advertisements')
      .update({ display_order: null })
      .neq('status', 'active')

    if (clearError) {
      console.error('[Ad Ordering Migration] Error clearing non-active ads:', clearError)
    }

    console.log('[Ad Ordering Migration] ✅ Migration complete!')

    return NextResponse.json({
      success: true,
      message: 'Advertisement ordering system migration completed successfully',
      instructions: 'You must manually run this SQL in Supabase SQL Editor to add the display_order column',
      sql: `
-- Run this in Supabase SQL Editor:
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS display_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_advertisements_display_order ON advertisements(display_order) WHERE status = 'active' AND display_order IS NOT NULL;
      `,
      details: {
        active_ads_initialized: activeAds?.length || 0,
        settings_added: settingsToAdd.map(s => s.key),
        note: 'Column addition requires database owner privileges. Run the SQL above in Supabase, then re-run this endpoint.'
      }
    })

  } catch (error) {
    console.error('[Ad Ordering Migration] Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'If error is about missing column "display_order", run the SQL provided in the response above'
    }, { status: 500 })
  }
}
