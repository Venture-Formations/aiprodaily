import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the active publication
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Fetch from app_settings (original source)
    const { data: appPrompts, error: appError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'ai_prompt_%')

    if (appError) {
      return NextResponse.json({ error: appError.message }, { status: 500 })
    }

    console.log(`Found ${appPrompts?.length || 0} prompts in app_settings`)

    // Compare with publication_settings
    const { data: pubPrompts } = await supabaseAdmin
      .from('publication_settings')
      .select('id, key, value')
      .eq('publication_id', newsletter.id)
      .like('key', 'ai_prompt_%')

    const pubPromptsMap = new Map(pubPrompts?.map(p => [p.key, p]) || [])

    const updates: any[] = []
    const diagnostics: any[] = []

    for (const appPrompt of appPrompts || []) {
      const pubPrompt = pubPromptsMap.get(appPrompt.key)

      // Handle both string and object values from app_settings
      const appValue = typeof appPrompt.value === 'object'
        ? JSON.stringify(appPrompt.value)
        : appPrompt.value
      const pubValue = pubPrompt?.value

      const diag: any = {
        key: appPrompt.key,
        app_value_type: typeof appPrompt.value,
        app_value_length: appValue?.length || 0,
        pub_value_length: pubValue?.length || 0,
        values_match: appValue === pubValue
      }

      // Check if app_settings value is valid JSON
      if (typeof appPrompt.value === 'object') {
        diag.app_is_valid_json = true
      } else {
        try {
          JSON.parse(appValue)
          diag.app_is_valid_json = true
        } catch (e) {
          diag.app_is_valid_json = false
          // Plain text prompts are OK
          if (appValue?.startsWith('Y') || appValue?.startsWith('C')) {
            diag.app_is_plain_text = true
          }
        }
      }

      // If publication_settings has corrupted value but app_settings is good, restore it
      if (pubPrompt && !diag.values_match) {
        updates.push({
          id: pubPrompt.id,
          key: appPrompt.key,
          newValue: appValue,
          oldLength: pubValue?.length || 0,
          newLength: appValue?.length || 0
        })
      }

      diagnostics.push(diag)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        message: 'All prompts match app_settings - no restoration needed',
        diagnostics
      })
    }

    // Apply restorations
    let restoredCount = 0
    for (const update of updates) {
      const { error: updateError } = await supabaseAdmin
        .from('publication_settings')
        .update({
          value: update.newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id)

      if (!updateError) {
        restoredCount++
      }
    }

    return NextResponse.json({
      message: `Restored ${restoredCount} AI prompts from app_settings`,
      totalPrompts: appPrompts?.length || 0,
      restoredCount,
      updates: updates.map(u => ({
        key: u.key,
        oldLength: u.oldLength,
        newLength: u.newLength
      })),
      diagnostics
    })

  } catch (error) {
    console.error('Error restoring AI prompts:', error)
    return NextResponse.json({
      error: 'Failed to restore AI prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
