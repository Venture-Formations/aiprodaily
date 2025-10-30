import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

/**
 * Migrates existing criteria settings to be newsletter-specific.
 * Adds newsletter_id to existing criteria settings that don't have one.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const newsletterSlug = searchParams.get('newsletter_slug') || 'accounting'

    console.log('[MIGRATE-CRITERIA] Starting migration for newsletter:', newsletterSlug)

    // Get newsletter UUID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug')
      .eq('slug', newsletterSlug)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[MIGRATE-CRITERIA] Newsletter not found:', newsletterSlug)
      return NextResponse.json(
        { error: `Newsletter '${newsletterSlug}' not found` },
        { status: 404 }
      )
    }

    const newsletterId = newsletter.id
    console.log('[MIGRATE-CRITERIA] Newsletter:', newsletter.name, '→ UUID:', newsletterId)

    // Find all criteria settings WITHOUT newsletter_id
    const { data: existingSettings, error: selectError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .or('key.like.criteria_%_name,key.like.criteria_%_weight,key.like.secondary_criteria_%_name,key.like.secondary_criteria_%_weight,key.eq.criteria_enabled_count')
      .is('newsletter_id', null)

    if (selectError) {
      console.error('[MIGRATE-CRITERIA] Error finding settings:', selectError)
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    console.log(`[MIGRATE-CRITERIA] Found ${existingSettings?.length || 0} settings to migrate`)

    if (!existingSettings || existingSettings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No criteria settings found to migrate (already have newsletter_id)',
        settingsMigrated: []
      })
    }

    // Update each setting to include newsletter_id
    const migrated: Array<{ key: string; value: string; description: string | null }> = []
    const failed: Array<{ key: string; error: string }> = []

    for (const setting of existingSettings) {
      console.log(`[MIGRATE-CRITERIA] Migrating: ${setting.key} = ${setting.value}`)

      // Delete the old row (without newsletter_id)
      const { error: deleteError } = await supabaseAdmin
        .from('app_settings')
        .delete()
        .eq('key', setting.key)
        .is('newsletter_id', null)

      if (deleteError) {
        console.error(`[MIGRATE-CRITERIA] Error deleting ${setting.key}:`, deleteError)
        failed.push({ key: setting.key, error: deleteError.message })
        continue
      }

      // Insert new row with newsletter_id
      const { error: insertError } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          newsletter_id: newsletterId
        })

      if (insertError) {
        console.error(`[MIGRATE-CRITERIA] Error inserting ${setting.key}:`, insertError)
        failed.push({ key: setting.key, error: insertError.message })
      } else {
        console.log(`[MIGRATE-CRITERIA] ✓ Migrated: ${setting.key}`)
        migrated.push({
          key: setting.key,
          value: setting.value,
          description: setting.description
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${migrated.length} criteria settings to newsletter '${newsletter.name}'`,
      newsletter: {
        name: newsletter.name,
        slug: newsletter.slug,
        id: newsletterId
      },
      settingsMigrated: migrated,
      settingsFailed: failed,
      summary: {
        total: existingSettings.length,
        migrated: migrated.length,
        failed: failed.length
      }
    })

  } catch (error: any) {
    console.error('[MIGRATE-CRITERIA] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
