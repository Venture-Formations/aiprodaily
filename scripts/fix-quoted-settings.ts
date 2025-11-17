// Fix quoted values in publication_settings table
// Removes extra JSON quotes like '"value"' -> 'value'

import { supabaseAdmin } from '../src/lib/supabase'

async function fixQuotedSettings() {
  console.log('Fetching all publication_settings...')

  const { data: settings, error } = await supabaseAdmin
    .from('publication_settings')
    .select('id, key, value')

  if (error) {
    console.error('Error fetching settings:', error)
    return
  }

  console.log(`Found ${settings?.length || 0} settings`)

  let fixedCount = 0
  const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []

  for (const setting of settings || []) {
    if (setting.value &&
        setting.value.startsWith('"') &&
        setting.value.endsWith('"') &&
        setting.value.length > 2) {
      const newValue = setting.value.slice(1, -1)
      updates.push({
        id: setting.id,
        key: setting.key,
        oldValue: setting.value,
        newValue
      })
    }
  }

  console.log(`\nFound ${updates.length} settings with extra quotes:\n`)

  for (const update of updates) {
    console.log(`  ${update.key}: ${update.oldValue} -> ${update.newValue}`)
  }

  if (updates.length === 0) {
    console.log('No settings need fixing!')
    return
  }

  console.log(`\nUpdating ${updates.length} settings...`)

  for (const update of updates) {
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .update({ value: update.newValue, updated_at: new Date().toISOString() })
      .eq('id', update.id)

    if (updateError) {
      console.error(`Error updating ${update.key}:`, updateError)
    } else {
      fixedCount++
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} settings`)
}

fixQuotedSettings()
