/**
 * Initialize AI App Module for a Publication
 * POST /api/ai-app-modules/initialize
 *
 * Creates a default AI App module for a publication using existing settings.
 * This migrates the legacy AI Apps settings to the new module system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { publication_id } = await request.json()

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Check if a module already exists
    const { data: existingModules } = await supabaseAdmin
      .from('ai_app_modules')
      .select('id, name')
      .eq('publication_id', publication_id)

    if (existingModules && existingModules.length > 0) {
      return NextResponse.json({
        message: 'AI App modules already exist for this publication',
        modules: existingModules
      })
    }

    // Get existing settings from publication_settings
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publication_id)
      .in('key', ['ai_apps_per_newsletter', 'ai_apps_max_per_category', 'affiliate_cooldown_days'])

    const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])

    // Create default AI Apps module with migrated settings
    const { data: newModule, error: createError } = await supabaseAdmin
      .from('ai_app_modules')
      .insert({
        publication_id,
        name: 'AI Applications',
        display_order: 10, // Default to after most content sections
        is_active: true,
        selection_mode: 'affiliate_priority',
        block_order: ['title', 'description', 'button'],
        apps_count: settingsMap.get('ai_apps_per_newsletter') || 6,
        max_per_category: settingsMap.get('ai_apps_max_per_category') || 3,
        affiliate_cooldown_days: settingsMap.get('affiliate_cooldown_days') || 7
      })
      .select()
      .single()

    if (createError) {
      console.error('[AI App Modules Initialize] Error creating module:', createError)
      return NextResponse.json(
        { error: 'Failed to create module', details: createError.message },
        { status: 500 }
      )
    }

    console.log('[AI App Modules Initialize] Created default module:', newModule.id)

    return NextResponse.json({
      message: 'AI App module created successfully',
      module: newModule,
      migrated_settings: {
        apps_count: newModule.apps_count,
        max_per_category: newModule.max_per_category,
        affiliate_cooldown_days: newModule.affiliate_cooldown_days
      }
    })

  } catch (error) {
    console.error('[AI App Modules Initialize] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Initialize AI App modules for ALL publications
 * GET /api/ai-app-modules/initialize
 */
export async function GET() {
  try {
    // Get all publications
    const { data: publications, error: pubError } = await supabaseAdmin
      .from('publications')
      .select('id, name')

    if (pubError || !publications) {
      return NextResponse.json(
        { error: 'Failed to fetch publications' },
        { status: 500 }
      )
    }

    const results = []

    for (const pub of publications) {
      // Check if module exists
      const { data: existing } = await supabaseAdmin
        .from('ai_app_modules')
        .select('id')
        .eq('publication_id', pub.id)
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({
          publication: pub.name,
          status: 'skipped',
          reason: 'Module already exists'
        })
        continue
      }

      // Get settings
      const { data: settings } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', pub.id)
        .in('key', ['ai_apps_per_newsletter', 'ai_apps_max_per_category', 'affiliate_cooldown_days'])

      const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])

      // Create module
      const { data: newModule, error: createError } = await supabaseAdmin
        .from('ai_app_modules')
        .insert({
          publication_id: pub.id,
          name: 'AI Applications',
          display_order: 10,
          is_active: true,
          selection_mode: 'affiliate_priority',
          block_order: ['title', 'description', 'button'],
          apps_count: settingsMap.get('ai_apps_per_newsletter') || 6,
          max_per_category: settingsMap.get('ai_apps_max_per_category') || 3,
          affiliate_cooldown_days: settingsMap.get('affiliate_cooldown_days') || 7
        })
        .select()
        .single()

      if (createError) {
        results.push({
          publication: pub.name,
          status: 'error',
          reason: createError.message
        })
      } else {
        results.push({
          publication: pub.name,
          status: 'created',
          module_id: newModule.id,
          settings: {
            apps_count: newModule.apps_count,
            max_per_category: newModule.max_per_category,
            affiliate_cooldown_days: newModule.affiliate_cooldown_days
          }
        })
      }
    }

    return NextResponse.json({
      message: 'Initialization complete',
      results
    })

  } catch (error) {
    console.error('[AI App Modules Initialize] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
