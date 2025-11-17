import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  return handleMigrateAIPrompts()
}

export async function POST(request: NextRequest) {
  return handleMigrateAIPrompts()
}

async function handleMigrateAIPrompts() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the active publication
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    console.log(`Migrating AI prompts for publication: ${newsletter.name} (${newsletter.id})`)

    // Fetch all AI prompts from app_settings
    const { data: appPrompts, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .like('key', 'ai_prompt_%')

    if (fetchError) {
      console.error('Error fetching app_settings:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    console.log(`Found ${appPrompts?.length || 0} AI prompts in app_settings`)

    if (!appPrompts || appPrompts.length === 0) {
      return NextResponse.json({
        message: 'No AI prompts found in app_settings to migrate',
        migrated: 0
      })
    }

    // Also fetch criteria weights and names
    const { data: criteriaSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .or('key.like.criteria_%_weight,key.like.criteria_%_name,key.like.primary_criteria_%,key.like.secondary_criteria_%')

    console.log(`Found ${criteriaSettings?.length || 0} criteria settings in app_settings`)

    // Combine all settings to migrate
    const allSettings = [...appPrompts, ...(criteriaSettings || [])]

    // Check what already exists in publication_settings
    const { data: existingSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('key')
      .eq('publication_id', newsletter.id)
      .or('key.like.ai_prompt_%,key.like.criteria_%,key.like.primary_criteria_%,key.like.secondary_criteria_%')

    const existingKeys = new Set(existingSettings?.map(s => s.key) || [])
    console.log(`Found ${existingKeys.size} existing settings in publication_settings`)

    // Migrate each setting
    let migratedCount = 0
    let skippedCount = 0
    const migrated: string[] = []
    const skipped: string[] = []

    for (const setting of allSettings) {
      if (existingKeys.has(setting.key)) {
        console.log(`Skipping ${setting.key} - already exists`)
        skippedCount++
        skipped.push(setting.key)
        continue
      }

      const { error: insertError } = await supabaseAdmin
        .from('publication_settings')
        .insert({
          publication_id: newsletter.id,
          key: setting.key,
          value: setting.value,
          description: setting.description || `Migrated from app_settings: ${setting.key}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error(`Error migrating ${setting.key}:`, insertError)
      } else {
        console.log(`Migrated ${setting.key}`)
        migratedCount++
        migrated.push(setting.key)
      }
    }

    return NextResponse.json({
      message: `Successfully migrated ${migratedCount} settings`,
      publication: newsletter.name,
      publication_id: newsletter.id,
      totalInAppSettings: allSettings.length,
      migratedCount,
      skippedCount,
      migrated,
      skipped
    })

  } catch (error) {
    console.error('Error in migrate-ai-prompts:', error)
    return NextResponse.json({
      error: 'Failed to migrate AI prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
