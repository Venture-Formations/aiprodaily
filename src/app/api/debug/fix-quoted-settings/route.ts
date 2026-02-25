import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

async function handleFixQuotedSettings(logger: any) {
  logger.info('Fetching all publication_settings...')

  const { data: settings, error } = await supabaseAdmin
    .from('publication_settings')
    .select('id, key, value')

  if (error) {
    logger.error({ err: error }, 'Error fetching settings')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info({ count: settings?.length || 0 }, 'Found settings')

  const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []

  for (const setting of settings || []) {
    if (setting.value &&
        setting.value.startsWith('"') &&
        setting.value.endsWith('"') &&
        setting.value.length > 2) {
      let newValue: string

      // Try to parse as JSON first (handles escaped JSON strings)
      try {
        const parsed = JSON.parse(setting.value)
        // If the parsed value is a string, use it directly
        // If it's an object, stringify it back without extra quotes
        if (typeof parsed === 'string') {
          newValue = parsed
        } else {
          // This shouldn't happen, but handle it anyway
          newValue = JSON.stringify(parsed)
        }
      } catch (e) {
        // If JSON.parse fails, fall back to simple quote stripping
        newValue = setting.value.slice(1, -1)
      }

      // Only update if the value actually changed
      if (newValue !== setting.value) {
        updates.push({
          id: setting.id,
          key: setting.key,
          oldValue: setting.value,
          newValue
        })
      }
    }
  }

  logger.info({ count: updates.length }, 'Found settings with extra quotes')

  if (updates.length === 0) {
    return NextResponse.json({
      message: 'No settings need fixing!',
      totalSettings: settings?.length || 0,
      fixedCount: 0
    })
  }

  let fixedCount = 0
  for (const update of updates) {
    logger.info({ key: update.key }, 'Fixing setting')
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .update({ value: update.newValue, updated_at: new Date().toISOString() })
      .eq('id', update.id)

    if (updateError) {
      logger.error({ key: update.key, err: updateError }, 'Error updating setting')
    } else {
      fixedCount++
    }
  }

  return NextResponse.json({
    message: `Fixed ${fixedCount} settings`,
    totalSettings: settings?.length || 0,
    fixedCount,
    updates: updates.map(u => ({ key: u.key, old: u.oldValue, new: u.newValue }))
  })
}

// Allow both GET and POST for convenience
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/fix-quoted-settings' },
  async ({ logger }) => {
    return handleFixQuotedSettings(logger)
  }
)

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/fix-quoted-settings' },
  async ({ logger }) => {
    return handleFixQuotedSettings(logger)
  }
)
